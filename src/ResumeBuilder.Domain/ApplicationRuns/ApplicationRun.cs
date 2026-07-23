using ResumeBuilder.Domain.Common;

namespace ResumeBuilder.Domain.ApplicationRuns;

public enum ApplicationRunStatus
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
    Failed,
}

public enum ControlOwner
{
    Agent,
    User,
    None,
}

public sealed class ApplicationRun : AggregateRoot
{
    public ApplicationRun(
        Guid id,
        Guid ownerId,
        Guid jobApplicationId,
        Guid profileId,
        Guid? resumeId,
        Uri target,
        ApplicationRunStatus status,
        string stage,
        ControlOwner controlOwner,
        int retryCount,
        string? browserSessionReference,
        Guid concurrencyToken,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt)
        : base(id, ownerId, concurrencyToken, createdAt, updatedAt)
    {
        JobApplicationId = jobApplicationId;
        ProfileId = profileId;
        ResumeId = resumeId;
        Target = target;
        Status = status;
        Stage = stage;
        ControlOwner = controlOwner;
        RetryCount = retryCount;
        BrowserSessionReference = browserSessionReference;
    }

    public Guid JobApplicationId { get; }

    public Guid ProfileId { get; }

    public Guid? ResumeId { get; }

    public Uri Target { get; }

    public ApplicationRunStatus Status { get; private set; }

    public string Stage { get; private set; }

    public ControlOwner ControlOwner { get; private set; }

    public int RetryCount { get; private set; }

    public string? BrowserSessionReference { get; private set; }

    public void RestoreState(
        ApplicationRunStatus status,
        string stage,
        ControlOwner controlOwner,
        int retryCount,
        string? browserSessionReference,
        DateTimeOffset occurredAt)
    {
        Status = status;
        Stage = stage;
        ControlOwner = controlOwner;
        RetryCount = retryCount;
        BrowserSessionReference = browserSessionReference;
        MarkChanged(occurredAt);
    }
}

public sealed record RunCheckpoint(
    Guid Id,
    Guid OwnerId,
    Guid RunId,
    long Sequence,
    ApplicationRunStatus Status,
    string Stage,
    string? CurrentUrl,
    string? CurrentDomain,
    string SummaryJson,
    DateTimeOffset CreatedAt);

public sealed record AgentAction(
    Guid Id,
    Guid OwnerId,
    Guid RunId,
    long Sequence,
    string ActionType,
    string Summary,
    string TaskDefinitionVersion,
    string OutputSchemaVersion,
    string? ModelId,
    string? ModelRevision,
    string? Provider,
    DateTimeOffset CreatedAt);

public sealed record PendingQuestion(
    Guid Id,
    Guid OwnerId,
    Guid RunId,
    string Prompt,
    string Kind,
    DateTimeOffset CreatedAt,
    DateTimeOffset? AnsweredAt);
