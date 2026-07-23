using System.Collections.Concurrent;
using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public interface IRunCheckpointStore
{
    Task AppendAsync(Checkpoint checkpoint, CancellationToken cancellationToken);
    Task<Checkpoint?> GetLatestAsync(Guid runId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Checkpoint>> GetActivityAsync(Guid runId, CancellationToken cancellationToken);
    Task DeleteAsync(Guid runId, CancellationToken cancellationToken);
}

public sealed class InMemoryRunCheckpointStore : IRunCheckpointStore
{
    private readonly ConcurrentDictionary<Guid, List<Checkpoint>> _checkpoints = new();

    public Task AppendAsync(Checkpoint checkpoint, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var list = _checkpoints.GetOrAdd(checkpoint.RunId, _ => []);
        lock (list)
        {
            var expected = list.Count == 0 ? 1 : list[^1].Sequence + 1;
            if (checkpoint.Sequence != expected)
            {
                throw new InvalidOperationException($"Checkpoint sequence must be {expected}.");
            }

            list.Add(checkpoint);
        }

        return Task.CompletedTask;
    }

    public Task<Checkpoint?> GetLatestAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_checkpoints.TryGetValue(runId, out var list)) return Task.FromResult<Checkpoint?>(null);
        lock (list) return Task.FromResult<Checkpoint?>(list.Count == 0 ? null : list[^1]);
    }

    public Task<IReadOnlyList<Checkpoint>> GetActivityAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_checkpoints.TryGetValue(runId, out var list)) return Task.FromResult<IReadOnlyList<Checkpoint>>([]);
        lock (list) return Task.FromResult<IReadOnlyList<Checkpoint>>(list.ToArray());
    }

    public Task DeleteAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _checkpoints.TryRemove(runId, out _);
        return Task.CompletedTask;
    }
}
