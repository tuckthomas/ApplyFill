using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Runtime;

public sealed class ApiApprovedArtifactStore(
    HttpClient httpClient,
    IOptions<ApplyFillApiOptions> options,
    TimeProvider timeProvider) : IApprovedArtifactStore, IAsyncDisposable
{
    private const long MaximumBytes = 10 * 1024 * 1024;
    private readonly ApplyFillApiOptions _options = ApiRelevantAnswerSource.ValidateOptions(options.Value);
    private readonly ConcurrentDictionary<(Guid RunId, Guid ArtifactId), ApprovedArtifact> _staged = new();
    private readonly string _stagingRoot = InitializeStagingRoot();

    public async Task<ApprovedArtifact?> GetLatestForRunAsync(
        Guid runId,
        Guid resumeId,
        CancellationToken cancellationToken)
    {
        if (runId == Guid.Empty || resumeId == Guid.Empty)
        {
            return null;
        }

        ResumeArtifactMetadata[]? artifacts;
        try
        {
            artifacts = await httpClient.GetFromJsonAsync<ResumeArtifactMetadata[]>(
                new Uri(_options.BaseUri, $"api/v1/resumes/{resumeId:D}/artifacts"),
                cancellationToken);
        }
        catch (HttpRequestException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return null;
        }

        var selected = artifacts?
            .Where(IsEligible)
            .OrderByDescending(value => value.CreatedAt)
            .FirstOrDefault();
        return selected is null
            ? null
            : await StageAsync(runId, selected, cancellationToken);
    }

    public async Task<ApprovedArtifact?> GetVerifiedAsync(
        Guid artifactId,
        Guid runId,
        CancellationToken cancellationToken)
    {
        if (!_staged.TryGetValue((runId, artifactId), out var artifact)) return null;
        var verified = await VerifyAsync(artifact, cancellationToken);
        if (verified is not null) return verified;

        if (_staged.TryRemove((runId, artifactId), out var invalid))
        {
            DeleteStagedFile(invalid.StagedPath);
        }
        return null;
    }

    public Task ReleaseRunAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        foreach (var item in _staged.Where(item => item.Key.RunId == runId).ToArray())
        {
            if (_staged.TryRemove(item.Key, out var artifact))
            {
                DeleteStagedFile(artifact.StagedPath);
            }
        }

        var runDirectory = Path.GetFullPath(Path.Combine(_stagingRoot, runId.ToString("N")));
        var root = Path.GetFullPath(_stagingRoot).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (runDirectory.StartsWith(root, StringComparison.OrdinalIgnoreCase) && Directory.Exists(runDirectory))
        {
            DeleteDirectory(runDirectory);
        }

        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var runId in _staged.Keys.Select(key => key.RunId).Distinct().ToArray())
        {
            await ReleaseRunAsync(runId, CancellationToken.None);
        }
        DeleteDirectory(_stagingRoot);
    }

    private async Task<ApprovedArtifact?> StageAsync(
        Guid runId,
        ResumeArtifactMetadata metadata,
        CancellationToken cancellationToken)
    {
        if (_staged.TryGetValue((runId, metadata.Id), out var existing) &&
            await VerifyAsync(existing, cancellationToken) is { } verified)
        {
            return verified;
        }
        if (_staged.TryRemove((runId, metadata.Id), out var invalid))
        {
            DeleteStagedFile(invalid.StagedPath);
        }

        var extension = Path.GetExtension(metadata.FileName).ToLowerInvariant();
        var runDirectory = Path.Combine(_stagingRoot, runId.ToString("N"));
        Directory.CreateDirectory(runDirectory);
        var finalPath = Path.Combine(runDirectory, $"{metadata.Id:N}{extension}");
        var partialPath = finalPath + $".{Guid.NewGuid():N}.part";

        try
        {
            using var response = await httpClient.GetAsync(
                new Uri(_options.BaseUri, $"api/v1/resumes/{metadata.ResumeId:D}/artifacts/{metadata.Id:D}/content"),
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);
            if (!response.IsSuccessStatusCode ||
                response.Content.Headers.ContentLength is > MaximumBytes ||
                response.Content.Headers.ContentLength is { } length && length != metadata.SizeBytes)
            {
                return null;
            }

            await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
            await using (var destination = new FileStream(
                             partialPath,
                             FileMode.CreateNew,
                             FileAccess.Write,
                             FileShare.None,
                             bufferSize: 64 * 1024,
                             FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                var buffer = new byte[64 * 1024];
                long total = 0;
                int read;
                while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
                {
                    total += read;
                    if (total > MaximumBytes || total > metadata.SizeBytes)
                    {
                        return null;
                    }

                    await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                }

                if (total != metadata.SizeBytes)
                {
                    return null;
                }
            }

            string digest;
            await using (var hashInput = File.OpenRead(partialPath))
            {
                digest = Convert.ToHexString(await SHA256.HashDataAsync(hashInput, cancellationToken));
            }
            if (!FixedTimeHexEquals(digest, metadata.Sha256))
            {
                return null;
            }

            File.Move(partialPath, finalPath, overwrite: true);
            var artifact = new ApprovedArtifact(
                metadata.Id,
                runId,
                Path.GetFileName(metadata.FileName),
                metadata.MediaType,
                metadata.SizeBytes,
                metadata.Sha256,
                finalPath,
                timeProvider.GetUtcNow().AddHours(2));
            _staged[(runId, metadata.Id)] = artifact;
            return artifact;
        }
        finally
        {
            if (File.Exists(partialPath))
            {
                File.Delete(partialPath);
            }
        }
    }

    private async Task<ApprovedArtifact?> VerifyAsync(
        ApprovedArtifact artifact,
        CancellationToken cancellationToken)
    {
        if (artifact.ExpiresAt <= timeProvider.GetUtcNow() || !File.Exists(artifact.StagedPath))
        {
            return null;
        }

        var info = new FileInfo(artifact.StagedPath);
        if (info.Length != artifact.ByteLength)
        {
            return null;
        }

        await using var stream = File.OpenRead(artifact.StagedPath);
        var digest = Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken));
        return FixedTimeHexEquals(digest, artifact.Sha256) ? artifact : null;
    }

    private static bool IsEligible(ResumeArtifactMetadata value)
    {
        if (value.SizeBytes is <= 0 or > MaximumBytes || value.Sha256.Length != 64)
        {
            return false;
        }

        var extension = Path.GetExtension(value.FileName);
        return extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase) &&
               value.MediaType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ||
               extension.Equals(".docx", StringComparison.OrdinalIgnoreCase) &&
               value.MediaType.Equals(
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                   StringComparison.OrdinalIgnoreCase);
    }

    private static bool FixedTimeHexEquals(string left, string right)
    {
        try
        {
            return CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(left),
                Convert.FromHexString(right));
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private void DeleteStagedFile(string path)
    {
        var fullPath = Path.GetFullPath(path);
        var root = Path.GetFullPath(_stagingRoot).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath))
        {
            File.Delete(fullPath);
            var directory = Path.GetDirectoryName(fullPath);
            if (directory is not null && Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any())
            {
                Directory.Delete(directory);
            }
        }
    }

    private static string InitializeStagingRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), "ApplyFill", "approved-artifacts");
        DeleteDirectory(root);
        Directory.CreateDirectory(root);
        return root;
    }

    private static void DeleteDirectory(string path)
    {
        if (!Directory.Exists(path)) return;
        Directory.Delete(path, recursive: true);
    }

    private sealed record ResumeArtifactMetadata(
        Guid Id,
        Guid ResumeId,
        string FileName,
        string MediaType,
        long SizeBytes,
        string Sha256,
        DateTimeOffset CreatedAt);
}
