using System.Collections.Concurrent;
using System.Security.Cryptography;
using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Runtime;

public sealed class InMemoryApprovedArtifactStore : IApprovedArtifactStore
{
    private readonly ConcurrentDictionary<Guid, ApprovedArtifact> _artifacts = new();

    public void Add(ApprovedArtifact artifact) => _artifacts[artifact.Id] = artifact;

    public async Task<ApprovedArtifact?> GetLatestForRunAsync(Guid runId, Guid resumeId, CancellationToken cancellationToken)
    {
        var artifact = _artifacts.Values
            .Where(value => value.RunId == runId)
            .OrderByDescending(value => value.ExpiresAt)
            .FirstOrDefault();
        return artifact is null
            ? null
            : await GetVerifiedAsync(artifact.Id, runId, cancellationToken);
    }

    public async Task<ApprovedArtifact?> GetVerifiedAsync(Guid artifactId, Guid runId, CancellationToken cancellationToken)
    {
        if (!_artifacts.TryGetValue(artifactId, out var artifact) || artifact.RunId != runId || artifact.ExpiresAt <= DateTimeOffset.UtcNow)
            return null;
        if (!File.Exists(artifact.StagedPath)) return null;

        var info = new FileInfo(artifact.StagedPath);
        if (info.Length != artifact.ByteLength) return null;

        await using var stream = File.OpenRead(artifact.StagedPath);
        var hash = Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken));
        return CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(hash),
            Convert.FromHexString(artifact.Sha256))
            ? artifact
            : null;
    }

    public Task ReleaseRunAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        foreach (var artifact in _artifacts.Where(item => item.Value.RunId == runId).Select(item => item.Key).ToArray())
        {
            _artifacts.TryRemove(artifact, out _);
        }
        return Task.CompletedTask;
    }
}
