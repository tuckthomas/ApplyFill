using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class DataRetentionService(ApplyFillDbContext dbContext, IArtifactStore artifactStore) : IDataRetentionService
{
    public async Task<RetentionResult> PurgeExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var artifacts = await dbContext.Artifacts
            .Where(x => x.ExpiresAt != null && x.ExpiresAt <= now)
            .Take(500)
            .ToListAsync(cancellationToken);
        foreach (var artifact in artifacts)
        {
            await artifactStore.DeleteAsync(artifact.OwnerId, artifact.StorageKey, cancellationToken);
        }

        dbContext.Artifacts.RemoveRange(artifacts);
        var sessions = await dbContext.BrowserSessions
            .Where(x => x.RecoveryStateExpiresAt != null && x.RecoveryStateExpiresAt <= now && x.ProtectedRecoveryState != null)
            .Take(500)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.ProtectedRecoveryState = null;
            session.RecoveryStateExpiresAt = null;
            session.UpdatedAt = now;
        }

        var receiptsDeleted = await dbContext.ApiIdempotencyRecords
            .Where(x => x.ExpiresAt <= now)
            .ExecuteDeleteAsync(cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new RetentionResult(artifacts.Count, sessions.Count, receiptsDeleted);
    }
}
