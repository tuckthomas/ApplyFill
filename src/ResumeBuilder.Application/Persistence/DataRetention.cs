namespace ResumeBuilder.Application.Persistence;

public interface IDataRetentionService
{
    Task<RetentionResult> PurgeExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken);
}

public sealed record RetentionResult(
    int ArtifactsDeleted,
    int RecoveryStatesDeleted,
    int IdempotencyReceiptsDeleted = 0);
