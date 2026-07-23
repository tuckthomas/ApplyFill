namespace ResumeBuilder.BrowserWorker.Contracts;

public sealed record StartBrowserRunRequest(
    string TargetUrl,
    Guid ProfileId,
    Guid? ResumeId,
    Guid? JobApplicationId,
    string? CompanyName,
    string? JobTitle);
public sealed record BrowserRunCommandRequest(string Command, long ExpectedRevision);
public sealed record BrowserQuestionAnswerRequest(string? OptionId, string? Value, bool SaveToProfile, long ExpectedRevision);

public sealed record BrowserInputRequest(
    string Kind,
    string? Event,
    double? X,
    double? Y,
    int? Button,
    double? DeltaX,
    double? DeltaY,
    string? Key,
    string? Code,
    bool Alt,
    bool Control,
    bool Meta,
    bool Shift,
    long FrameSequence,
    long PageGeneration,
    int? ViewportWidth,
    int? ViewportHeight);

public sealed record BrowserAgentActivity(
    string Id,
    DateTimeOffset OccurredAt,
    string Summary,
    string? Detail,
    string Kind);

public sealed record BrowserAgentQuestionOption(string Id, string Label, string? Description);

public sealed record BrowserAgentQuestion(
    string Id,
    string Prompt,
    string Context,
    string Category,
    IReadOnlyList<BrowserAgentQuestionOption>? Options,
    bool AllowFreeText,
    bool CanSaveToProfile,
    string? ApprovalId = null,
    string? ApprovalConcurrencyToken = null,
    string? MaskedValue = null);

public sealed record BrowserRunReview(
    IReadOnlyList<string> SectionsAnswered,
    string? ResumeName,
    string? CoverLetterName,
    IReadOnlyList<string> SensitiveDisclosures,
    IReadOnlyList<string> UserModifiedFields,
    IReadOnlyList<string> UnresolvedWarnings,
    bool ApprovalRecorded);

public sealed record BrowserRunSnapshot(
    string Id,
    long Revision,
    string State,
    string ControlOwner,
    string? CompanyName,
    string? JobTitle,
    string CurrentUrl,
    string CurrentDomain,
    string ApplicationStage,
    string StatusMessage,
    string? ControlReason,
    string? CurrentAction,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? FrameUpdatedAt,
    int? FrameWidth,
    int? FrameHeight,
    long? FrameSequence,
    long? FramePageGeneration,
    float? FrameDeviceScaleFactor,
    string? FrameUrl,
    BrowserAgentQuestion? PendingQuestion,
    IReadOnlyList<BrowserAgentActivity> Activity,
    BrowserRunReview? Review,
    bool CanResume,
    bool CheckpointRetained);

public sealed record BrowserRunSummary(
    string Id,
    string State,
    string? CompanyName,
    string? JobTitle,
    string CurrentDomain,
    string ApplicationStage,
    DateTimeOffset UpdatedAt,
    bool CanResume);

public sealed record FrameAvailableMessage(
    string RunId,
    string FrameUrl,
    DateTimeOffset FrameUpdatedAt,
    int Width,
    int Height,
    long Sequence,
    long PageGeneration,
    float DeviceScaleFactor);
