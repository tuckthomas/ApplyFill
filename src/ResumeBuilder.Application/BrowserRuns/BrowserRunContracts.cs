using ResumeBuilder.Domain.ApplicationRuns;

namespace ResumeBuilder.Application.BrowserRuns;

public enum ApplicationRunControlCommand
{
    Pause,
    Resume,
    Stop,
    TakeControl,
    ReturnControl,
    Recover,
}

public sealed record StartApplicationRun(
    Uri Target,
    Guid ProfileId,
    Guid? ResumeId,
    Guid? JobApplicationId,
    string? CompanyName,
    string? JobTitle);

public sealed record ApplicationRunCommand(
    ApplicationRunControlCommand Command,
    Guid ExpectedConcurrencyToken);

public sealed record ApplicationRunQuestionAnswer(
    Guid QuestionId,
    string? OptionId,
    string? Value,
    bool SaveToProfile,
    Guid ExpectedConcurrencyToken);

public sealed record ApplicationRunPendingQuestion(
    Guid Id,
    string Prompt,
    string Category,
    IReadOnlyList<string> Options,
    bool AllowsFreeText);

public sealed record ApplicationRunSnapshot(
    Guid Id,
    ApplicationRunStatus Status,
    ControlOwner ControlOwner,
    string Stage,
    Uri CurrentUri,
    int ProgressPercent,
    ApplicationRunPendingQuestion? PendingQuestion,
    bool Recoverable,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public interface IApplicationRunService
{
    Task<IReadOnlyList<ApplicationRunSnapshot>> ListAsync(
        ApplicationRunStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task<ApplicationRunSnapshot?> FindAsync(Guid runId, CancellationToken cancellationToken);

    Task<ApplicationRunSnapshot> StartAsync(
        StartApplicationRun request,
        CancellationToken cancellationToken);

    Task<ApplicationRunSnapshot> ExecuteAsync(
        Guid runId,
        ApplicationRunCommand command,
        CancellationToken cancellationToken);

    Task<ApplicationRunSnapshot> AnswerQuestionAsync(
        Guid runId,
        ApplicationRunQuestionAnswer answer,
        CancellationToken cancellationToken);

    Task<ApplicationRunSnapshot> ApproveArtifactAsync(
        Guid runId,
        Guid artifactId,
        Guid expectedConcurrencyToken,
        CancellationToken cancellationToken);

    Task<ApplicationRunSnapshot> ApproveFinalSubmissionAsync(
        Guid runId,
        Guid expectedConcurrencyToken,
        CancellationToken cancellationToken);
}

public sealed record BrowserSessionStartRequest(
    Guid RunId,
    Uri Target,
    IReadOnlySet<string> ApprovedDomains,
    bool ReuseProfile,
    string? ReusableProfileId,
    int ViewportWidth = 1280,
    int ViewportHeight = 800,
    float DeviceScaleFactor = 1);

public sealed record BrowserSessionSnapshot(
    Guid SessionId,
    Guid RunId,
    Uri CurrentUri,
    long PageGeneration,
    ControlOwner ControlOwner,
    DateTimeOffset StartedAt,
    bool IsConnected);

public interface IBrowserSession : IAsyncDisposable
{
    Guid SessionId { get; }

    Guid RunId { get; }

    Task<BrowserSessionSnapshot> GetSnapshotAsync(CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);
}

public interface IBrowserSessionFactory
{
    Task<IBrowserSession> StartAsync(
        BrowserSessionStartRequest request,
        CancellationToken cancellationToken);

    Task<IBrowserSession?> ReattachAsync(
        Guid sessionId,
        Guid runId,
        CancellationToken cancellationToken);
}
