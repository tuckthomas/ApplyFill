using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Runtime;

public interface IManagedBrowserRuntime : IAsyncDisposable
{
    Task<BrowserSessionDescriptor> StartAsync(Guid runId, BrowserSessionStart request, CancellationToken cancellationToken);
    Task<BrowserSessionDescriptor?> GetAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken);
    Task<ViewportFrame> CaptureFrameAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken);
    Task<PageObservation> ObserveAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken);
    Task RelayInputAsync(Guid sessionId, string ownerId, long controlEpoch, BrowserInput input, CancellationToken cancellationToken);
    Task<BrowserActionResult> ExecuteAsync(Guid sessionId, string ownerId, long controlEpoch, BrowserAction action, ApprovedArtifact? artifact, CancellationToken cancellationToken);
    Task StopAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken);
}

public interface IApprovedArtifactStore
{
    Task<ApprovedArtifact?> GetLatestForRunAsync(Guid runId, Guid resumeId, CancellationToken cancellationToken);
    Task<ApprovedArtifact?> GetVerifiedAsync(Guid artifactId, Guid runId, CancellationToken cancellationToken);
    Task ReleaseRunAsync(Guid runId, CancellationToken cancellationToken);
}

public interface IViewportFrameSink
{
    Task PublishAsync(ViewportFrame frame, CancellationToken cancellationToken);
}

public sealed class NullViewportFrameSink : IViewportFrameSink
{
    public Task PublishAsync(ViewportFrame frame, CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed record FramePumpOptions
{
    public int FramesPerSecond { get; init; } = 5;
    public int LowBandwidthFramesPerSecond { get; init; } = 2;
    public int MaxFrameBytes { get; init; } = 2_500_000;
    public int HealthyFramesBeforeRecovery { get; init; } = 3;
}

public sealed class BrowserRuntimeOptions
{
    public const string SectionName = "BrowserRuntime";

    public int MaxConcurrentSessions { get; init; } = 2;
    public string ProfileRoot { get; init; } = Path.Combine(Path.GetTempPath(), "ApplyFill", "browser-profiles");
    public string DownloadRoot { get; init; } = Path.Combine(Path.GetTempPath(), "ApplyFill", "browser-downloads");
    public bool Headless { get; init; } = true;
    public bool AllowHttpForDevelopment { get; init; }
    public int ScreenshotQuality { get; init; } = 72;
    public IReadOnlySet<string> IdentityProviderHosts { get; init; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "accounts.google.com",
        "login.microsoftonline.com",
        "appleid.apple.com"
    };
}

public enum BrowserRuntimeFailureKind
{
    BrowserCrashed,
    PageCrashed,
    BrowserDisconnected,
    PageClosed,
    TimedOut,
    ActionFailed
}

public sealed class BrowserRuntimeException(
    BrowserRuntimeFailureKind kind,
    string code,
    string message,
    Exception? innerException = null) : Exception(message, innerException)
{
    public BrowserRuntimeFailureKind Kind { get; } = kind;
    public string Code { get; } = code;
}
