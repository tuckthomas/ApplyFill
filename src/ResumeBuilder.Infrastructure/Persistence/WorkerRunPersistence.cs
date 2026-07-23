using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Domain.JobApplications;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class WorkerRunPersistence(
    ApplyFillDbContext dbContext,
    IClock clock,
    IIdentifierGenerator identifiers) : IWorkerRunPersistence
{
    public async Task<PersistentRunProjection> StartOrGetAsync(
        Guid ownerId,
        PersistWorkerRunRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedTarget = ValidateStart(request);
        var existing = await dbContext.ApplicationRuns.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Id == request.RunId,
            cancellationToken);
        if (existing is not null)
        {
            if (existing.ProfileId != request.ProfileId ||
                !existing.TargetUrl.Equals(normalizedTarget, StringComparison.Ordinal) ||
                existing.ResumeId != request.ResumeId ||
                request.JobApplicationId is { } requestedJobApplicationId &&
                existing.JobApplicationId != requestedJobApplicationId)
            {
                throw new ConcurrencyConflictException(nameof(ApplicationRun), request.RunId);
            }

            return Map(existing);
        }

        var profileExists = await dbContext.Profiles.AsNoTracking()
            .AnyAsync(x => x.OwnerId == ownerId && x.Id == request.ProfileId, cancellationToken);
        if (!profileExists)
        {
            throw new InvalidOperationException("The selected profile was not found.");
        }

        if (request.ResumeId is { } resumeId && !await dbContext.Resumes.AsNoTracking()
                .AnyAsync(x => x.OwnerId == ownerId && x.Id == resumeId, cancellationToken))
        {
            throw new InvalidOperationException("The selected resume was not found.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var jobApplicationId = request.JobApplicationId ?? identifiers.NewId();
        if (request.JobApplicationId is { } selectedJobApplicationId)
        {
            var jobExists = await dbContext.JobApplications.AsNoTracking()
                .AnyAsync(x => x.OwnerId == ownerId && x.Id == selectedJobApplicationId, cancellationToken);
            if (!jobExists)
            {
                throw new InvalidOperationException("The selected job application was not found.");
            }
        }
        else
        {
            var target = new Uri(normalizedTarget);
            var now = clock.UtcNow;
            dbContext.JobApplications.Add(new JobApplicationRecord
            {
                Id = jobApplicationId,
                OwnerId = ownerId,
                Company = target.Host.Length <= 200 ? target.Host : target.Host[..200],
                JobTitle = "Application",
                TargetUrl = target.AbsoluteUri,
                Status = JobApplicationStatus.Preparing,
                DetailsJson = "{\"source\":\"browser-agent\"}",
                ConcurrencyToken = identifiers.NewId(),
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        var createdAt = clock.UtcNow;
        var row = new ApplicationRunRecord
        {
            Id = request.RunId,
            OwnerId = ownerId,
            JobApplicationId = jobApplicationId,
            ProfileId = request.ProfileId,
            ResumeId = request.ResumeId,
            TargetUrl = normalizedTarget,
            Status = request.Status,
            Stage = request.Stage.Trim(),
            ControlOwner = request.ControlOwner,
            LastCheckpointSequence = 0,
            CurrentUrl = RedactUrl(normalizedTarget),
            BrowserSessionReference = request.BrowserSessionReference,
            ConcurrencyToken = identifiers.NewId(),
            CreatedAt = createdAt,
            UpdatedAt = createdAt,
        };
        dbContext.ApplicationRuns.Add(row);
        dbContext.RunCheckpoints.Add(new RunCheckpointRecord
        {
            Id = identifiers.NewId(),
            OwnerId = ownerId,
            RunId = request.RunId,
            Sequence = 0,
            Status = request.Status,
            Stage = request.Stage.Trim(),
            CurrentUrl = normalizedTarget,
            CurrentDomain = new Uri(normalizedTarget).Host,
            SummaryJson = "{\"event\":\"run-created\"}",
            CreatedAt = createdAt,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Map(row);
    }

    public async Task<PersistentRunProjection?> UpdateAndCheckpointAsync(
        Guid ownerId,
        Guid runId,
        PersistWorkerCheckpointRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(request.Sequence);
        ArgumentOutOfRangeException.ThrowIfNegative(request.RetryCount);
        if (request.Stage.Length is < 1 or > 160)
        {
            throw new ArgumentException("The run stage is required and may contain at most 160 characters.");
        }

        var summary = StructuredJsonValidator.ValidateAndNormalize(request.Summary, 64 * 1024);
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var row = await dbContext.ApplicationRuns.SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Id == runId,
            cancellationToken);
        if (row is null)
        {
            return null;
        }

        if (row.ConcurrencyToken != request.ExpectedConcurrencyToken)
        {
            throw new ConcurrencyConflictException(nameof(ApplicationRun), runId);
        }

        if (request.Sequence <= row.LastCheckpointSequence)
        {
            throw new ConcurrencyConflictException(nameof(RunCheckpoint), runId);
        }

        var currentUrl = string.IsNullOrWhiteSpace(request.CurrentUrl)
            ? null
            : RedactUrl(ProfileValueNormalizer.NormalizeUrl(request.CurrentUrl));
        row.Status = request.Status;
        row.Stage = request.Stage.Trim();
        row.ControlOwner = request.ControlOwner;
        row.RetryCount = request.RetryCount;
        row.LastCheckpointSequence = request.Sequence;
        row.CurrentUrl = currentUrl ?? row.CurrentUrl;
        row.BrowserSessionReference = request.BrowserSessionReference;
        row.ConcurrencyToken = identifiers.NewId();
        row.UpdatedAt = clock.UtcNow;
        if (request.Status == ApplicationRunStatus.Completed)
        {
            var application = await dbContext.JobApplications.SingleOrDefaultAsync(
                value => value.OwnerId == ownerId && value.Id == row.JobApplicationId,
                cancellationToken);
            if (application is not null && application.Status is JobApplicationStatus.Interested or JobApplicationStatus.Preparing)
            {
                application.Status = JobApplicationStatus.Applied;
                application.ConcurrencyToken = identifiers.NewId();
                application.UpdatedAt = row.UpdatedAt;
            }
        }
        dbContext.RunCheckpoints.Add(new RunCheckpointRecord
        {
            Id = identifiers.NewId(),
            OwnerId = ownerId,
            RunId = runId,
            Sequence = request.Sequence,
            Status = request.Status,
            Stage = request.Stage.Trim(),
            CurrentUrl = currentUrl,
            CurrentDomain = request.CurrentDomain,
            SummaryJson = summary,
            CreatedAt = row.UpdatedAt,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Map(row);
    }

    public async Task<PersistentRunProjection?> FindAsync(
        Guid ownerId,
        Guid runId,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.ApplicationRuns.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Id == runId,
            cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<PersistentRunProjection>> ListRecoverableAsync(
        Guid ownerId,
        int take,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(take, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(take, 100);
        var rows = await dbContext.ApplicationRuns.AsNoTracking()
            .Where(x => x.OwnerId == ownerId &&
                x.Status != ApplicationRunStatus.Completed)
            .OrderByDescending(x => x.UpdatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
        return rows.Select(Map).ToArray();
    }

    private static string ValidateStart(PersistWorkerRunRequest request)
    {
        if (request.RunId == Guid.Empty || request.ProfileId == Guid.Empty)
        {
            throw new ArgumentException("A stable run ID and profile ID are required.");
        }

        var normalizedTarget = ProfileValueNormalizer.NormalizeUrl(request.TargetUrl);
        if (request.Stage.Length is < 1 or > 160 || request.BrowserSessionReference?.Length > 240)
        {
            throw new ArgumentException("The run stage or browser-session reference exceeds its accepted bounds.");
        }

        return normalizedTarget;
    }

    private static PersistentRunProjection Map(ApplicationRunRecord row) => new(
        row.Id,
        row.JobApplicationId,
        row.ProfileId,
        row.ResumeId,
        row.TargetUrl,
        row.Status,
        row.Stage,
        row.ControlOwner,
        row.RetryCount,
        row.LastCheckpointSequence,
        row.CurrentUrl,
        row.BrowserSessionReference,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.UpdatedAt);

    private static string RedactUrl(string value)
    {
        var uri = new Uri(value);
        return uri.GetComponents(
            UriComponents.SchemeAndServer | UriComponents.Path,
            UriFormat.UriEscaped);
    }
}
