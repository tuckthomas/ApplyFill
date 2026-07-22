using System.Buffers;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using ResumeBuilder.PrivateAi.Catalog;

namespace ResumeBuilder.PrivateAi.Installation;

public sealed record ArtifactProgress(
    string ArtifactName,
    long VerifiedBytes,
    long TotalBytes,
    bool IsVerifying);

public sealed class ArtifactInstaller(HttpClient httpClient, string installationRoot)
{
    private readonly string _installationRoot = Path.GetFullPath(
        string.IsNullOrWhiteSpace(installationRoot)
            ? throw new ArgumentException("Installation root is required.", nameof(installationRoot))
            : installationRoot);

    public async Task<string> InstallAsync(
        string componentId,
        string revision,
        PrivateAiArtifact artifact,
        IProgress<ArtifactProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        ValidatePathSegment(componentId, nameof(componentId));
        ValidatePathSegment(revision, nameof(revision));
        ArgumentNullException.ThrowIfNull(artifact);

        if (artifact.Url.Scheme != Uri.UriSchemeHttps || Path.GetFileName(artifact.FileName) != artifact.FileName)
        {
            throw new InvalidDataException("Private AI artifact location is not trusted.");
        }

        var componentRoot = EnsureContainedPath(_installationRoot, componentId, revision);
        Directory.CreateDirectory(componentRoot);
        EnsureDiskSpace(componentRoot, artifact.Bytes);

        var destination = EnsureContainedPath(componentRoot, artifact.FileName);
        if (File.Exists(destination) && await VerifyAsync(destination, artifact, progress, cancellationToken))
        {
            return destination;
        }

        var partial = destination + ".partial";
        var existingBytes = File.Exists(partial) ? new FileInfo(partial).Length : 0;
        if (existingBytes > artifact.Bytes)
        {
            File.Delete(partial);
            existingBytes = 0;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, artifact.Url);
        if (existingBytes > 0)
        {
            request.Headers.Range = new RangeHeaderValue(existingBytes, null);
        }

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        if (existingBytes > 0 && response.StatusCode == HttpStatusCode.OK)
        {
            File.Delete(partial);
            existingBytes = 0;
        }

        response.EnsureSuccessStatusCode();
        if (existingBytes > 0 && response.StatusCode != HttpStatusCode.PartialContent)
        {
            throw new InvalidDataException("Private AI download server did not honor the resume request.");
        }

        await using (var source = await response.Content.ReadAsStreamAsync(cancellationToken))
        await using (var target = new FileStream(
            partial,
            existingBytes == 0 ? FileMode.Create : FileMode.Append,
            FileAccess.Write,
            FileShare.None,
            1024 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan))
        {
            var buffer = ArrayPool<byte>.Shared.Rent(1024 * 1024);
            try
            {
                var downloaded = existingBytes;
                int count;
                while ((count = await source.ReadAsync(buffer, cancellationToken)) > 0)
                {
                    await target.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
                    downloaded += count;
                    if (downloaded > artifact.Bytes)
                    {
                        throw new InvalidDataException("Private AI artifact exceeded its declared size.");
                    }

                    progress?.Report(new ArtifactProgress(artifact.FileName, downloaded, artifact.Bytes, false));
                }

                await target.FlushAsync(cancellationToken);
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        if (!await VerifyAsync(partial, artifact, progress, cancellationToken))
        {
            File.Delete(partial);
            throw new InvalidDataException($"Private AI artifact verification failed: {artifact.FileName}");
        }

        File.Move(partial, destination, true);
        return destination;
    }

    public static async Task<bool> VerifyAsync(
        string path,
        PrivateAiArtifact artifact,
        IProgress<ArtifactProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        var file = new FileInfo(path);
        if (!file.Exists || file.Length != artifact.Bytes)
        {
            return false;
        }

        progress?.Report(new ArtifactProgress(artifact.FileName, 0, artifact.Bytes, true));
        await using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            1024 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        progress?.Report(new ArtifactProgress(artifact.FileName, artifact.Bytes, artifact.Bytes, true));
        return Convert.ToHexStringLower(hash).Equals(artifact.Sha256, StringComparison.Ordinal);
    }

    private static string EnsureContainedPath(string root, params string[] parts)
    {
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var candidate = Path.GetFullPath(Path.Combine([root, .. parts]));
        if (!candidate.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("Private AI artifact path escaped its installation directory.");
        }

        return candidate;
    }

    private static void ValidatePathSegment(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value) || value is "." or ".." ||
            value.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || value.Contains(Path.DirectorySeparatorChar) ||
            value.Contains(Path.AltDirectorySeparatorChar))
        {
            throw new ArgumentException("Value must be a single safe path segment.", parameterName);
        }
    }

    private static void EnsureDiskSpace(string path, long artifactBytes)
    {
        var root = Path.GetPathRoot(Path.GetFullPath(path)) ?? throw new IOException("Unable to determine installation drive.");
        var required = checked(artifactBytes + Math.Max(artifactBytes / 10, 512L * 1024 * 1024));
        if (new DriveInfo(root).AvailableFreeSpace < required)
        {
            throw new IOException("There is not enough disk space to set up Private AI.");
        }
    }
}
