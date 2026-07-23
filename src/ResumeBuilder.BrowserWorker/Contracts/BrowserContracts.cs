using System.Collections.Immutable;

namespace ResumeBuilder.BrowserWorker.Contracts;

public enum RunState
{
    Created,
    StartingBrowser,
    Navigating,
    Observing,
    Planning,
    AgentRunning,
    Pausing,
    Paused,
    UserControl,
    AwaitingUser,
    Recovering,
    ReviewReady,
    Submitting,
    Completed,
    Stopped,
    Failed
}

public enum ControlOwner
{
    None,
    Agent,
    User
}

public enum BrowserActionKind
{
    Navigate,
    Focus,
    Click,
    Type,
    Select,
    Check,
    Scroll,
    UploadApprovedArtifact,
    OpenTab,
    CloseTab,
    Wait
}

public enum BrowserActionOutcome
{
    Succeeded,
    ValidationFailed,
    StaleObservation,
    Blocked,
    NavigationStarted,
    UserInterrupted,
    BrowserError
}

public enum BrowserInputKind
{
    PointerMove,
    PointerDown,
    PointerUp,
    Wheel,
    KeyDown,
    KeyUp,
    InsertText,
    Composition,
    Focus,
    Resize
}

public enum PageKind
{
    ApplicationStep,
    Login,
    Mfa,
    Captcha,
    Review,
    Confirmation,
    Error,
    Unrelated,
    Unsupported
}

public sealed record BrowserSessionStart(
    Uri StartUri,
    string OwnerId,
    IReadOnlySet<string> ApprovedDomains,
    bool ReuseProfile = false,
    string? ReusableProfileId = null,
    int ViewportWidth = 1280,
    int ViewportHeight = 800,
    float DeviceScaleFactor = 1);

public sealed record BrowserSessionDescriptor(
    Guid SessionId,
    Guid RunId,
    string OwnerId,
    Uri CurrentUri,
    long PageGeneration,
    ControlOwner ControlOwner,
    DateTimeOffset StartedAt,
    bool IsConnected);

public sealed record ViewportFrame(
    Guid SessionId,
    long Sequence,
    long PageGeneration,
    int Width,
    int Height,
    float DeviceScaleFactor,
    DateTimeOffset CapturedAt,
    byte[] JpegBytes);

public sealed record BrowserInput(
    BrowserInputKind Kind,
    long PageGeneration,
    long FrameSequence,
    double? X = null,
    double? Y = null,
    double? DeltaX = null,
    double? DeltaY = null,
    string? Key = null,
    string? Text = null,
    int? Button = null,
    bool Alt = false,
    bool Control = false,
    bool Meta = false,
    bool Shift = false,
    int? ViewportWidth = null,
    int? ViewportHeight = null);

public sealed record BrowserAction(
    BrowserActionKind Kind,
    long PageGeneration,
    string? Handle = null,
    Uri? TargetUri = null,
    string? Value = null,
    bool? Checked = null,
    double? DeltaX = null,
    double? DeltaY = null,
    Guid? ArtifactId = null,
    TimeSpan? Delay = null,
    string? ExpectedResult = null);

public sealed record BrowserActionResult(
    BrowserActionOutcome Outcome,
    string Code,
    string Message,
    long PageGeneration,
    bool PostconditionVerified,
    DateTimeOffset CompletedAt);

public sealed record VisibleControl(
    string Handle,
    string Role,
    string? Label,
    string? Type,
    bool Required,
    bool Enabled,
    bool Checked,
    bool Sensitive,
    string? CurrentValue,
    ImmutableArray<string> Options);

public sealed record PageObservation(
    int SchemaVersion,
    Guid SessionId,
    long PageGeneration,
    Uri Uri,
    string Title,
    PageKind Kind,
    ImmutableArray<VisibleControl> Controls,
    ImmutableArray<string> ValidationMessages,
    byte[] Screenshot,
    DateTimeOffset ObservedAt,
    bool ContainsSuspiciousInstructions = false);

public sealed record ApprovedArtifact(
    Guid Id,
    Guid RunId,
    string FileName,
    string ContentType,
    long ByteLength,
    string Sha256,
    string StagedPath,
    DateTimeOffset ExpiresAt);

public sealed record ControlLease(
    Guid SessionId,
    ControlOwner Owner,
    long Epoch,
    DateTimeOffset AcquiredAt);

public sealed record Checkpoint(
    Guid Id,
    Guid RunId,
    long Sequence,
    RunState State,
    string PageStage,
    Uri? CurrentUri,
    long PageGeneration,
    string Intent,
    string Target,
    string Result,
    ControlOwner Actor,
    DateTimeOffset CreatedAt,
    bool SubmissionApproved,
    bool SubmissionAttempted);

public sealed record RunLimits(
    int MaxActions = 250,
    int MaxModelCalls = 100,
    int MaxConsecutiveFailures = 3,
    int MaxNoProgressCycles = 5,
    TimeSpan? MaxElapsed = null)
{
    public TimeSpan EffectiveMaxElapsed => MaxElapsed ?? TimeSpan.FromHours(2);
}

public sealed record StartBrowserSessionRequest(Guid RunId, BrowserSessionStart Session);
public sealed record StartBrowserSessionResponse(BrowserSessionDescriptor Session, string AccessToken, ControlLease Control);
