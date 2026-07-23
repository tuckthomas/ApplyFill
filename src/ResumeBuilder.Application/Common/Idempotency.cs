namespace ResumeBuilder.Application.Common;

public enum IdempotencyAcquireState
{
    Acquired,
    Replay,
    Conflict,
    InProgress,
}

public sealed record IdempotencyReplay(
    int StatusCode,
    string? ContentType,
    byte[] Body,
    string? ETag,
    string? Location);

public sealed record IdempotencyAcquisition(IdempotencyAcquireState State, IdempotencyReplay? Replay = null);

public interface IApiIdempotencyStore
{
    Task<IdempotencyAcquisition> AcquireAsync(
        Guid ownerId,
        string key,
        string method,
        string path,
        string requestHash,
        CancellationToken cancellationToken);

    Task CompleteAsync(
        Guid ownerId,
        string key,
        string requestHash,
        IdempotencyReplay response,
        CancellationToken cancellationToken);

    Task AbandonAsync(Guid ownerId, string key, string requestHash, CancellationToken cancellationToken);
}
