using System.Text.Json;
using ResumeBuilder.Domain.ApplicationRuns;

namespace ResumeBuilder.Application.Persistence;

public sealed record PersistWorkerRunRequest(
    Guid RunId,
    Guid ProfileId,
    Guid? ResumeId,
    Guid? JobApplicationId,
    string TargetUrl,
    ApplicationRunStatus Status,
    string Stage,
    ControlOwner ControlOwner,
    string? BrowserSessionReference);

public sealed record PersistWorkerCheckpointRequest(
    Guid ExpectedConcurrencyToken,
    long Sequence,
    ApplicationRunStatus Status,
    string Stage,
    ControlOwner ControlOwner,
    int RetryCount,
    string? BrowserSessionReference,
    string? CurrentUrl,
    string? CurrentDomain,
    JsonElement Summary);

public sealed record PersistentRunProjection(
    Guid RunId,
    Guid JobApplicationId,
    Guid ProfileId,
    Guid? ResumeId,
    string TargetUrl,
    ApplicationRunStatus Status,
    string Stage,
    ControlOwner ControlOwner,
    int RetryCount,
    long LastCheckpointSequence,
    string? CurrentUrl,
    string? BrowserSessionReference,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public interface IWorkerRunPersistence
{
    Task<PersistentRunProjection> StartOrGetAsync(
        Guid ownerId,
        PersistWorkerRunRequest request,
        CancellationToken cancellationToken);

    Task<PersistentRunProjection?> UpdateAndCheckpointAsync(
        Guid ownerId,
        Guid runId,
        PersistWorkerCheckpointRequest request,
        CancellationToken cancellationToken);

    Task<PersistentRunProjection?> FindAsync(Guid ownerId, Guid runId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PersistentRunProjection>> ListRecoverableAsync(
        Guid ownerId,
        int take,
        CancellationToken cancellationToken);
}
