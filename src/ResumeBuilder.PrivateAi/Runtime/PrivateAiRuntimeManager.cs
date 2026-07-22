using ResumeBuilder.PrivateAi.Catalog;
using ResumeBuilder.PrivateAi.Setup;

namespace ResumeBuilder.PrivateAi.Runtime;

public sealed class PrivateAiRuntimeManager(
    PrivateAiCatalog catalog,
    LlamaCppRuntimeSupervisor supervisor,
    string installationRoot) : IAsyncDisposable
{
    private readonly SemaphoreSlim _activationLock = new(1, 1);
    private readonly string _installationRoot = Path.GetFullPath(installationRoot);

    public string? ActiveModelId { get; private set; }

    public async Task<LlamaCppRuntimeEndpoint> ActivateAsync(
        PrivateAiInstallation installation,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(installation);
        await _activationLock.WaitAsync(cancellationToken);
        try
        {
            var model = catalog.Models.SingleOrDefault(item => item.Id.Equals(modelId, StringComparison.Ordinal))
                ?? throw new PrivateAiUnavailableException("The requested Private AI capability is not installed.");
            if (modelId != installation.ModelId && modelId != installation.DocumentModelId)
            {
                throw new PrivateAiUnavailableException("The requested Private AI model is not part of the active installation.");
            }

            if (ActiveModelId == modelId && supervisor.Endpoint is not null)
            {
                return supervisor.Endpoint;
            }

            await supervisor.StopAsync();
            var runtime = catalog.GetRuntime(model.RuntimeId);
            var runtimeDirectory = GetRuntimeDirectory(runtime.Id, runtime.Version);
            var executable = Directory.EnumerateFiles(runtimeDirectory, runtime.EntryPoint, SearchOption.AllDirectories).SingleOrDefault()
                ?? throw new FileNotFoundException("Private AI runtime is incomplete.", runtime.EntryPoint);
            var modelPath = installation.ArtifactPaths[$"{model.Id}:model"];
            var projectorPath = installation.ArtifactPaths[$"{model.Id}:vision-projector"];
            var endpoint = await supervisor.StartAsync(
                new LlamaCppRuntimeConfiguration(
                    executable,
                    modelPath,
                    projectorPath,
                    model.Id,
                    model.ContextTokens,
                    runtime.Accelerator.StartsWith("cuda", StringComparison.Ordinal) ? "auto" : "0",
                    TimeSpan.FromMinutes(5)),
                cancellationToken);
            ActiveModelId = modelId;
            return endpoint;
        }
        finally
        {
            _activationLock.Release();
        }
    }

    public async Task DeactivateAsync()
    {
        await _activationLock.WaitAsync();
        try
        {
            await supervisor.StopAsync();
            ActiveModelId = null;
        }
        finally
        {
            _activationLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await supervisor.DisposeAsync();
        _activationLock.Dispose();
    }

    private string GetRuntimeDirectory(string runtimeId, string version)
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
}
