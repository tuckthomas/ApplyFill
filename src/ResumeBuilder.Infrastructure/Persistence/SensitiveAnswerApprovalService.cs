using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Profiles;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class SensitiveAnswerApprovalService(
    ApplyFillDbContext dbContext,
    ISensitiveValueProtector protector,
    IClock clock,
    IIdentifierGenerator identifiers) : ISensitiveAnswerApprovalService
{
    private static readonly TimeSpan ApprovalLifetime = TimeSpan.FromMinutes(15);

    public async Task<SensitiveAnswerApproval> RequestAsync(
        Guid ownerId,
        SensitiveApprovalRequest request,
        CancellationToken cancellationToken)
    {
        ValidateRequest(request);
        var run = await dbContext.ApplicationRuns.AsNoTracking().SingleOrDefaultAsync(
            x => x.Id == request.RunId && x.OwnerId == ownerId && x.ProfileId == request.ProfileId,
            cancellationToken) ?? throw new InvalidOperationException("The application run or profile was not found.");
        _ = run;
        var profile = await dbContext.Profiles.AsNoTracking().SingleOrDefaultAsync(
            x => x.Id == request.ProfileId && x.OwnerId == ownerId,
            cancellationToken) ?? throw new InvalidOperationException("The profile was not found.");
        var value = ResolveSensitiveValue(profile, request.SourcePath);
        var now = clock.UtcNow;

        var existing = await dbContext.SensitiveAnswerApprovals.AsNoTracking()
            .Where(x =>
                x.OwnerId == ownerId &&
                x.RunId == request.RunId &&
                x.ControlId == request.ControlId &&
                x.SourcePath == request.SourcePath &&
                x.State == SensitiveApprovalState.Pending &&
                x.ExpiresAt > now &&
                x.ProfileConcurrencyToken == profile.ConcurrencyToken)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
        {
            return Map(existing);
        }

        var row = new SensitiveAnswerApprovalRecord
        {
            Id = identifiers.NewId(),
            OwnerId = ownerId,
            RunId = request.RunId,
            ProfileId = request.ProfileId,
            ControlId = request.ControlId,
            SourcePath = request.SourcePath,
            DisplayName = request.DisplayName.Trim(),
            MaskedValue = Mask(value),
            State = SensitiveApprovalState.Pending,
            ProfileConcurrencyToken = profile.ConcurrencyToken,
            ConcurrencyToken = identifiers.NewId(),
            CreatedAt = now,
            ExpiresAt = now.Add(ApprovalLifetime),
        };
        dbContext.SensitiveAnswerApprovals.Add(row);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(row);
    }

    public async Task<IReadOnlyList<SensitiveAnswerApproval>> ListAsync(
        Guid ownerId,
        Guid runId,
        CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await dbContext.SensitiveAnswerApprovals
            .Where(x => x.OwnerId == ownerId && x.RunId == runId &&
                (x.State == SensitiveApprovalState.Pending || x.State == SensitiveApprovalState.Approved) &&
                x.ExpiresAt <= now)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(x => x.State, SensitiveApprovalState.Expired),
                cancellationToken);
        var rows = await dbContext.SensitiveAnswerApprovals.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && x.RunId == runId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);
        return rows.Select(Map).ToArray();
    }

    public async Task<SensitiveAnswerApproval?> DecideAsync(
        Guid ownerId,
        Guid runId,
        Guid approvalId,
        Guid expectedToken,
        bool approved,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.SensitiveAnswerApprovals.SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.RunId == runId && x.Id == approvalId,
            cancellationToken);
        if (row is null)
        {
            return null;
        }

        if (row.ConcurrencyToken != expectedToken)
        {
            throw new ConcurrencyConflictException(nameof(SensitiveAnswerApproval), approvalId);
        }

        if (row.State != SensitiveApprovalState.Pending || row.ExpiresAt <= clock.UtcNow)
        {
            throw new InvalidStateTransitionException(
                "This sensitive-answer request is no longer awaiting a decision.");
        }

        row.State = approved ? SensitiveApprovalState.Approved : SensitiveApprovalState.Denied;
        row.DecidedAt = clock.UtcNow;
        row.ConcurrencyToken = identifiers.NewId();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(row);
    }

    public async Task<ConsumedSensitiveAnswer?> ConsumeAsync(
        Guid ownerId,
        Guid runId,
        Guid approvalId,
        string controlId,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(controlId);
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var row = await dbContext.SensitiveAnswerApprovals
            .FromSqlInterpolated($"SELECT * FROM sensitive_answer_approvals WHERE \"Id\" = {approvalId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);
        if (row is null || row.OwnerId != ownerId || row.RunId != runId ||
            !row.ControlId.Equals(controlId, StringComparison.Ordinal) ||
            row.State != SensitiveApprovalState.Approved)
        {
            return null;
        }

        if (row.ExpiresAt <= clock.UtcNow)
        {
            row.State = SensitiveApprovalState.Expired;
            row.ConcurrencyToken = identifiers.NewId();
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return null;
        }

        var profile = await dbContext.Profiles.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Id == row.ProfileId,
            cancellationToken);
        if (profile is null || profile.ConcurrencyToken != row.ProfileConcurrencyToken)
        {
            row.State = SensitiveApprovalState.Expired;
            row.ConcurrencyToken = identifiers.NewId();
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return null;
        }

        var value = ResolveSensitiveValue(profile, row.SourcePath);
        row.State = SensitiveApprovalState.Consumed;
        row.ConsumedAt = clock.UtcNow;
        row.ConcurrencyToken = identifiers.NewId();
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ConsumedSensitiveAnswer(row.Id, row.ControlId, value);
    }

    private string ResolveSensitiveValue(ProfileRecord profile, string sourcePath)
    {
        if (profile.ProtectedApplicationData is null || !sourcePath.StartsWith("applicationData.", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The requested protected answer does not exist.");
        }

        using var document = JsonDocument.Parse(protector.Unprotect(profile.ProtectedApplicationData));
        var current = document.RootElement;
        var relativePath = sourcePath["applicationData.".Length..];
        foreach (var segment in relativePath.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            var bracket = segment.IndexOf('[');
            var propertyName = bracket < 0 ? segment : segment[..bracket];
            if (propertyName.Length == 0 || !current.TryGetProperty(propertyName, out current))
            {
                throw new InvalidOperationException("The requested protected answer does not exist.");
            }

            var offset = bracket;
            while (offset >= 0)
            {
                var end = segment.IndexOf(']', offset + 1);
                if (end < 0 || !int.TryParse(segment.AsSpan(offset + 1, end - offset - 1), out var index) ||
                    current.ValueKind != JsonValueKind.Array || index < 0 || index >= current.GetArrayLength())
                {
                    throw new InvalidOperationException("The requested protected answer path is invalid.");
                }

                current = current[index];
                offset = segment.IndexOf('[', end + 1);
            }
        }

        return current.ValueKind switch
        {
            JsonValueKind.String => current.GetString() ?? string.Empty,
            JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => current.GetRawText(),
            _ => throw new InvalidOperationException("Only a single protected answer can be approved."),
        };
    }

    private static void ValidateRequest(SensitiveApprovalRequest request)
    {
        if (request.RunId == Guid.Empty || request.ProfileId == Guid.Empty)
        {
            throw new ArgumentException("A run and profile are required.");
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(request.ControlId);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.SourcePath);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        if (request.ControlId.Length > 160 || request.SourcePath.Length > 500 || request.DisplayName.Length > 200)
        {
            throw new ArgumentException("The sensitive-answer request exceeds the accepted bounds.");
        }
    }

    private static string Mask(string value) => value.Length <= 4
        ? new string('•', value.Length)
        : $"••••{value[^4..]}";

    private static SensitiveAnswerApproval Map(SensitiveAnswerApprovalRecord row) => new(
        row.Id,
        row.OwnerId,
        row.RunId,
        row.ProfileId,
        row.ControlId,
        row.SourcePath,
        row.DisplayName,
        row.MaskedValue,
        row.State,
        row.ProfileConcurrencyToken,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.ExpiresAt,
        row.DecidedAt,
        row.ConsumedAt);
}
