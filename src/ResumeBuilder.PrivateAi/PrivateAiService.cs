using System.Text.Json;
using Microsoft.Extensions.Options;
using ResumeBuilder.Application.Models;
using ResumeBuilder.PrivateAi.Catalog;
using ResumeBuilder.PrivateAi.Installation;
using ResumeBuilder.PrivateAi.Runtime;
using ResumeBuilder.PrivateAi.Setup;

namespace ResumeBuilder.PrivateAi;

public interface IPrivateAiInference
{
    Task<VisionInferenceResult> InferAsync(
        VisionInferenceRequest request,
        CancellationToken cancellationToken = default);

    Task<DocumentParsingResult> ParseDocumentAsync(
        DocumentParsingRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class PrivateAiOptions
{
    public const string SectionName = "PrivateAi";

    public string CatalogDirectory { get; set; } = Path.Combine(AppContext.BaseDirectory, "private-ai", "catalog");
    public string InstallationRoot { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ApplyFill",
        "private-ai");
}

public sealed record PrivateAiServiceSnapshot(
    PrivateAiSetupState State,
    long CompletedBytes,
    long TotalBytes,
    string? Message,
    string? ActiveModelId,
    string DiagnosticsId);

public sealed class PrivateAiService : IPrivateAiInference, IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly PrivateAiOptions _options;
    private readonly HttpClient _downloadClient = new() { Timeout = Timeout.InfiniteTimeSpan };
    private readonly HttpClient _runtimeClient = new() { Timeout = TimeSpan.FromMinutes(10) };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _diagnosticsId = Guid.NewGuid().ToString("N");
    private PrivateAiCatalog? _catalog;
    private PrivateAiRuntimeManager? _runtimeManager;
    private PrivateAiInstallation? _installation;
    private CancellationTokenSource? _setupCancellation;
    private PrivateAiServiceSnapshot _snapshot;

    public PrivateAiService(IOptions<PrivateAiOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _options = options.Value;
        _snapshot = new PrivateAiServiceSnapshot(
            PrivateAiSetupState.NotConfigured,
            0,
            0,
            null,
            null,
            _diagnosticsId);
    }

    public event EventHandler<PrivateAiServiceSnapshot>? StatusChanged;

    public PrivateAiServiceSnapshot Status => _snapshot;

    public async Task<PrivateAiServiceSnapshot> InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureCatalogAsync(cancellationToken);
            _installation ??= await ReadInstallationAsync(cancellationToken);
            SetStatus(_installation is null
                ? _snapshot with { State = PrivateAiSetupState.NotConfigured, Message = "Private AI has not been set up." }
                : _snapshot with
                {
                    State = PrivateAiSetupState.Ready,
                    Message = null,
                    ActiveModelId = _installation.ModelId,
                    CompletedBytes = _snapshot.TotalBytes,
                });
            return _snapshot;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<PrivateAiServiceSnapshot> SetupAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_installation is not null)
            {
                return _snapshot;
            }

            var catalog = await EnsureCatalogAsync(cancellationToken);
            var probe = await PrivateAiHardwareProbe.ProbeAsync(cancellationToken);
            _setupCancellation?.Dispose();
            _setupCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var installer = new ArtifactInstaller(_downloadClient, _options.InstallationRoot);
            var coordinator = new PrivateAiSetupCoordinator(catalog, installer, _options.InstallationRoot);
            var progress = new Progress<PrivateAiSetupStatus>(status => SetStatus(new PrivateAiServiceSnapshot(
                status.State,
                status.CompletedBytes,
                status.TotalBytes,
                status.Message,
                status.ActiveModelId,
                _diagnosticsId)));

            try
            {
                _installation = await coordinator.SetupAsync(probe.Hardware, progress, _setupCancellation.Token);
                SetStatus(_snapshot with
                {
                    State = PrivateAiSetupState.Ready,
                    CompletedBytes = _snapshot.TotalBytes,
                    Message = null,
                    ActiveModelId = _installation.ModelId,
                });
            }
            catch (OperationCanceledException) when (_setupCancellation.IsCancellationRequested)
            {
                SetStatus(_snapshot with { State = PrivateAiSetupState.NeedsAttention, Message = "Private AI setup was paused. Try again to continue." });
                throw;
            }
            catch (Exception exception) when (exception is IOException or InvalidDataException or PrivateAiUnavailableException or HttpRequestException)
            {
                SetStatus(_snapshot with { State = PrivateAiSetupState.NeedsAttention, Message = exception.Message });
                throw;
            }

            return _snapshot;
        }
        finally
        {
            _gate.Release();
        }
    }

    public void CancelSetup() => _setupCancellation?.Cancel();

    public void BeginSetup()
    {
        if (_snapshot.State is PrivateAiSetupState.NotConfigured or PrivateAiSetupState.NeedsAttention or PrivateAiSetupState.Unavailable)
        {
            SetStatus(_snapshot with
            {
                State = PrivateAiSetupState.CheckingComputer,
                Message = "Checking this computer before downloading Private AI.",
            });
        }
    }

    public async Task<VisionInferenceResult> InferAsync(
        VisionInferenceRequest request,
        CancellationToken cancellationToken = default)
    {
        var (installation, _, manager) = await EnsureReadyAsync(cancellationToken);
        var endpoint = await manager.ActivateAsync(installation, installation.ModelId, cancellationToken);
        var provider = new LlamaCppVisionProvider(
            _runtimeClient,
            endpoint.BaseUri,
            installation.ModelId,
            installation.ModelRevision,
            endpoint.ApiKey);
        return await provider.InferAsync(request, cancellationToken);
    }

    public async Task<DocumentParsingResult> ParseDocumentAsync(
        DocumentParsingRequest request,
        CancellationToken cancellationToken = default)
    {
        var (installation, _, manager) = await EnsureReadyAsync(cancellationToken);
        var endpoint = await manager.ActivateAsync(installation, installation.DocumentModelId, cancellationToken);
        var visionProvider = new LlamaCppVisionProvider(
            _runtimeClient,
            endpoint.BaseUri,
            installation.DocumentModelId,
            installation.DocumentModelRevision,
            endpoint.ApiKey);
        var provider = new PaddleDocumentParsingProvider(
            visionProvider,
            installation.DocumentModelId,
            installation.DocumentModelRevision);
        return await provider.ParseAsync(request, cancellationToken);
    }

    public async Task RemoveAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_runtimeManager is not null)
            {
                await _runtimeManager.DeactivateAsync();
                await _runtimeManager.DisposeAsync();
                _runtimeManager = null;
            }

            var root = Path.GetFullPath(_options.InstallationRoot);
            var marker = Path.Combine(root, ".applyfill-private-ai");
            if (Directory.Exists(root) && File.Exists(marker) &&
                File.ReadAllText(marker).Equals("ApplyFill Private AI storage v1", StringComparison.Ordinal))
            {
                Directory.Delete(root, true);
            }

            _installation = null;
            SetStatus(new PrivateAiServiceSnapshot(
                PrivateAiSetupState.NotConfigured,
                0,
                0,
                "Private AI has not been set up.",
                null,
                _diagnosticsId));
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        _setupCancellation?.Cancel();
        _setupCancellation?.Dispose();
        if (_runtimeManager is not null)
        {
            await _runtimeManager.DisposeAsync();
        }

        _downloadClient.Dispose();
        _runtimeClient.Dispose();
        _gate.Dispose();
    }

    private async Task<(PrivateAiInstallation Installation, PrivateAiCatalog Catalog, PrivateAiRuntimeManager Manager)> EnsureReadyAsync(
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var catalog = await EnsureCatalogAsync(cancellationToken);
            _installation ??= await ReadInstallationAsync(cancellationToken)
                ?? throw new PrivateAiUnavailableException("Set up Private AI before starting an application.");
            _runtimeManager ??= new PrivateAiRuntimeManager(
                catalog,
                new LlamaCppRuntimeSupervisor(_runtimeClient),
                _options.InstallationRoot);
            return (_installation, catalog, _runtimeManager);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<PrivateAiCatalog> EnsureCatalogAsync(CancellationToken cancellationToken) =>
        _catalog ??= await PrivateAiCatalog.LoadAsync(_options.CatalogDirectory, cancellationToken);

    private async Task<PrivateAiInstallation?> ReadInstallationAsync(CancellationToken cancellationToken)
    {
        var path = Path.Combine(Path.GetFullPath(_options.InstallationRoot), "active-installation.json");
        if (!File.Exists(path))
        {
            return null;
        }

        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<PrivateAiInstallation>(stream, JsonOptions, cancellationToken);
    }

    private void SetStatus(PrivateAiServiceSnapshot status)
    {
        _snapshot = status;
        StatusChanged?.Invoke(this, status);
    }
}
