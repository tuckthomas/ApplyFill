using System.Text.Json;
using ResumeBuilder.PrivateAi.Catalog;
using ResumeBuilder.PrivateAi.Installation;

namespace ResumeBuilder.PrivateAi.Setup;

public enum PrivateAiSetupState
{
    NotConfigured,
    CheckingComputer,
    Downloading,
    Verifying,
    Preparing,
    Ready,
    NeedsAttention,
    Unavailable,
}

public sealed record PrivateAiSetupStatus(
    PrivateAiSetupState State,
    long CompletedBytes,
    long TotalBytes,
    string? Message,
    string? ActiveModelId);

public sealed record PrivateAiInstallation(
    string ModelId,
    string ModelRevision,
    string DocumentModelId,
    string DocumentModelRevision,
    string RuntimeId,
    string RuntimeVersion,
    string DocumentRuntimeId,
    string DocumentRuntimeVersion,
    IReadOnlyDictionary<string, string> ArtifactPaths,
    DateTimeOffset InstalledAt);

public sealed class PrivateAiSetupCoordinator(
    PrivateAiCatalog catalog,
    ArtifactInstaller installer,
    string installationRoot)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _installationRoot = Path.GetFullPath(installationRoot);

    public async Task<PrivateAiInstallation> SetupAsync(
        PrivateAiHardware hardware,
        IProgress<PrivateAiSetupStatus>? progress = null,
        CancellationToken cancellationToken = default)
    {
        progress?.Report(new PrivateAiSetupStatus(PrivateAiSetupState.CheckingComputer, 0, 0, null, null));
        PrivateAiModelManifest model;
        try
        {
            model = catalog.ResolveModel(
                ["page-understanding", "gui-grounding", "structured-actions"],
                hardware,
                PrivateAiPreference.Quality);
        }
        catch (PrivateAiUnavailableException exception)
        {
            progress?.Report(new PrivateAiSetupStatus(PrivateAiSetupState.Unavailable, 0, 0, exception.Message, null));
            throw;
        }

        var documentModel = catalog.ResolveModel(
            ["document-parsing", "resume-fact-extraction"],
            hardware,
            PrivateAiPreference.Quality);
        var runtime = catalog.GetRuntime(model.RuntimeId);
        var documentRuntime = catalog.GetRuntime(documentModel.RuntimeId);
        var runtimes = new[] { runtime, documentRuntime }.DistinctBy(item => item.Id);
        var components = runtimes.SelectMany(item =>
                item.Artifacts.Select(artifact => (Id: item.Id, Version: item.Version, Artifact: artifact)))
            .Concat(model.Artifacts.Select(artifact => (Id: model.Id, Version: model.Revision, Artifact: artifact)))
            .Concat(documentModel.Artifacts.Select(artifact => (Id: documentModel.Id, Version: documentModel.Revision, Artifact: artifact)))
            .ToList();
        var totalBytes = components.Sum(component => component.Artifact.Bytes);
        EnsureTotalCapacity(totalBytes);
        var completedBeforeCurrent = 0L;
        var paths = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var component in components)
        {
            var currentBase = completedBeforeCurrent;
            var artifactProgress = new Progress<ArtifactProgress>(item =>
            {
                var state = item.IsVerifying ? PrivateAiSetupState.Verifying : PrivateAiSetupState.Downloading;
                progress?.Report(new PrivateAiSetupStatus(
                    state,
                    Math.Min(totalBytes, currentBase + item.VerifiedBytes),
                    totalBytes,
                    null,
                    model.Id));
            });
            var path = await installer.InstallAsync(
                component.Id,
                component.Version,
                component.Artifact,
                artifactProgress,
                cancellationToken);
            paths[$"{component.Id}:{component.Artifact.Role}"] = path;
            completedBeforeCurrent += component.Artifact.Bytes;
        }

        progress?.Report(new PrivateAiSetupStatus(
            PrivateAiSetupState.Preparing,
            totalBytes,
            totalBytes,
            null,
            model.Id));
        foreach (var runtimeManifest in runtimes)
        {
            var archives = runtimeManifest.Artifacts
                .Select(artifact => paths[$"{runtimeManifest.Id}:{artifact.Role}"])
                .ToList();
            var runtimeDirectory = GetContainedRuntimeDirectory(runtimeManifest.Id, runtimeManifest.Version);
            RuntimeArchiveInstaller.ExtractVerifiedArchives(archives, runtimeDirectory);
        }

        var installation = new PrivateAiInstallation(
            model.Id,
            model.Revision,
            documentModel.Id,
            documentModel.Revision,
            runtime.Id,
            runtime.Version,
            documentRuntime.Id,
            documentRuntime.Version,
            paths,
            DateTimeOffset.UtcNow);
        await PersistInstallationAsync(installation, cancellationToken);
        progress?.Report(new PrivateAiSetupStatus(
            PrivateAiSetupState.Ready,
            totalBytes,
            totalBytes,
            null,
            model.Id));
        return installation;
    }

    private void EnsureTotalCapacity(long totalBytes)
    {
        Directory.CreateDirectory(_installationRoot);
        File.WriteAllText(Path.Combine(_installationRoot, ".applyfill-private-ai"), "ApplyFill Private AI storage v1");
        var driveRoot = Path.GetPathRoot(_installationRoot) ?? throw new IOException("ApplyFill could not determine the Private AI storage drive.");
        var installedBytes = Directory.EnumerateFiles(_installationRoot, "*", SearchOption.AllDirectories)
            .Sum(path => new FileInfo(path).Length);
        var remainingBytes = Math.Max(0, totalBytes - installedBytes);
        var safetyMargin = Math.Max(totalBytes / 10, 1024L * 1024 * 1024);
        if (new DriveInfo(driveRoot).AvailableFreeSpace < remainingBytes + safetyMargin)
        {
            var requiredGiB = Math.Ceiling((remainingBytes + safetyMargin) / (1024d * 1024 * 1024));
            throw new IOException($"Private AI needs about {requiredGiB:0} GB of free space. Choose a storage location with more room and try again.");
        }
    }

    private string GetContainedRuntimeDirectory(string runtimeId, string version)
    {
        var root = Path.Combine(_installationRoot, "runtimes");
        var guardedRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var path = Path.GetFullPath(Path.Combine(root, runtimeId, version));
        if (!path.StartsWith(guardedRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("Private AI runtime path escaped its installation directory.");
        }

        return path;
    }

    private async Task PersistInstallationAsync(
        PrivateAiInstallation installation,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_installationRoot);
        var destination = Path.Combine(_installationRoot, "active-installation.json");
        var staging = destination + ".staging";
        await using (var stream = new FileStream(
            staging,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            4096,
            FileOptions.Asynchronous | FileOptions.WriteThrough))
        {
            await JsonSerializer.SerializeAsync(stream, installation, JsonOptions, cancellationToken);
            await stream.FlushAsync(cancellationToken);
        }

        File.Move(staging, destination, true);
    }
}
