using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class ApiIdempotencyStore(
    ApplyFillDbContext dbContext,
    ISensitiveValueProtector protector,
    IClock clock,
    IIdentifierGenerator identifiers) : IApiIdempotencyStore
{
    private static readonly TimeSpan ReceiptLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan DuplicateWait = TimeSpan.FromSeconds(3);

    public async Task<IdempotencyAcquisition> AcquireAsync(
        Guid ownerId,
        string key,
        string method,
        string path,
        string requestHash,
        CancellationToken cancellationToken)
    {
        Validate(key, method, path, requestHash);
        var now = clock.UtcNow;
        var inserted = await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO api_idempotency
                ("Id", "OwnerId", "Key", "Method", "Path", "RequestHash", "State", "CreatedAt", "ExpiresAt")
            VALUES
                ({identifiers.NewId()}, {ownerId}, {key}, {method}, {path}, {requestHash},
                 {nameof(ApiIdempotencyState.InProgress)}, {now}, {now.Add(ReceiptLifetime)})
            ON CONFLICT ("OwnerId", "Key") DO NOTHING;
            """,
            cancellationToken);
        if (inserted == 1)
        {
            return new IdempotencyAcquisition(IdempotencyAcquireState.Acquired);
        }

        var wait = Stopwatch.StartNew();
        while (true)
        {
            var existing = await dbContext.ApiIdempotencyRecords.AsNoTracking()
                .SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Key == key, cancellationToken);
            if (existing is null || existing.ExpiresAt <= clock.UtcNow)
            {
                if (existing is not null)
                {
                    await dbContext.ApiIdempotencyRecords
                        .Where(x => x.Id == existing.Id && x.ExpiresAt <= clock.UtcNow)
                        .ExecuteDeleteAsync(cancellationToken);
                    return await AcquireAsync(ownerId, key, method, path, requestHash, cancellationToken);
                }

                return new IdempotencyAcquisition(IdempotencyAcquireState.InProgress);
            }

            if (!existing.RequestHash.Equals(requestHash, StringComparison.Ordinal) ||
                !existing.Method.Equals(method, StringComparison.Ordinal) ||
                !existing.Path.Equals(path, StringComparison.Ordinal))
            {
                return new IdempotencyAcquisition(IdempotencyAcquireState.Conflict);
            }

            if (existing.State == ApiIdempotencyState.Completed &&
                existing.StatusCode is { } statusCode &&
                existing.ProtectedResponseBody is { } protectedBody)
            {
                var body = Convert.FromBase64String(protector.Unprotect(protectedBody));
                return new IdempotencyAcquisition(
                    IdempotencyAcquireState.Replay,
                    new IdempotencyReplay(
                        statusCode,
                        existing.ContentType,
                        body,
                        existing.ETag,
                        existing.Location));
            }

            if (wait.Elapsed >= DuplicateWait)
            {
                return new IdempotencyAcquisition(IdempotencyAcquireState.InProgress);
            }

            await Task.Delay(100, cancellationToken);
        }
    }

    public async Task CompleteAsync(
        Guid ownerId,
        string key,
        string requestHash,
        IdempotencyReplay response,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.ApiIdempotencyRecords.SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Key == key && x.RequestHash == requestHash,
            cancellationToken);
        if (row is null || row.State != ApiIdempotencyState.InProgress)
        {
            return;
        }

        row.State = ApiIdempotencyState.Completed;
        row.StatusCode = response.StatusCode;
        row.ContentType = response.ContentType;
        row.ProtectedResponseBody = protector.Protect(Convert.ToBase64String(response.Body));
        row.ETag = response.ETag;
        row.Location = response.Location;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AbandonAsync(
        Guid ownerId,
        string key,
        string requestHash,
        CancellationToken cancellationToken)
    {
        await dbContext.ApiIdempotencyRecords
            .Where(x => x.OwnerId == ownerId && x.Key == key &&
                x.RequestHash == requestHash && x.State == ApiIdempotencyState.InProgress)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static void Validate(string key, string method, string path, string requestHash)
    {
        if (key.Length is < 8 or > 128 || method.Length is < 1 or > 12 ||
            path.Length is < 1 or > 2_048 || requestHash.Length != 64)
        {
            throw new ArgumentException("The idempotency receipt is invalid.");
        }
    }
}
