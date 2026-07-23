using ResumeBuilder.Application.Profiles;
using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Domain.JobApplications;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class ProfileRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public int SchemaVersion { get; set; }
    public string ContentJson { get; set; } = "{}";
    public string? ProtectedApplicationData { get; set; }
    public Guid ConcurrencyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ProfileSourceResumeRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MediaType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ResumeRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SchemaVersion { get; set; }
    public string ContentJson { get; set; } = "{}";
    public Guid ConcurrencyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public ICollection<ResumeArtifactRecord> Artifacts { get; set; } = [];
}

public sealed class ResumeArtifactRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid ResumeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MediaType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public ResumeRecord Resume { get; set; } = null!;
}

public sealed class JobApplicationRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string TargetUrl { get; set; } = string.Empty;
    public JobApplicationStatus Status { get; set; }
    public string DetailsJson { get; set; } = "{}";
    public Guid ConcurrencyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ApplicationRunRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid JobApplicationId { get; set; }
    public Guid ProfileId { get; set; }
    public Guid? ResumeId { get; set; }
    public string TargetUrl { get; set; } = string.Empty;
    public ApplicationRunStatus Status { get; set; }
    public string Stage { get; set; } = string.Empty;
    public ControlOwner ControlOwner { get; set; }
    public int RetryCount { get; set; }
    public long LastCheckpointSequence { get; set; } = -1;
    public string? CurrentUrl { get; set; }
    public string? BrowserSessionReference { get; set; }
    public Guid ConcurrencyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public ICollection<RunCheckpointRecord> Checkpoints { get; set; } = [];
}

public sealed class RunCheckpointRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid RunId { get; set; }
    public long Sequence { get; set; }
    public ApplicationRunStatus Status { get; set; }
    public string Stage { get; set; } = string.Empty;
    public string? CurrentUrl { get; set; }
    public string? CurrentDomain { get; set; }
    public string SummaryJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public ApplicationRunRecord Run { get; set; } = null!;
}

public sealed class AgentActionRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid RunId { get; set; }
    public long Sequence { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string TaskDefinitionVersion { get; set; } = string.Empty;
    public string OutputSchemaVersion { get; set; } = string.Empty;
    public string? ModelId { get; set; }
    public string? ModelRevision { get; set; }
    public string? Provider { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class PendingQuestionRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid RunId { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? AnsweredAt { get; set; }
}

public sealed class UserDecisionRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid RunId { get; set; }
    public Guid? QuestionId { get; set; }
    public string DecisionType { get; set; } = string.Empty;
    public string DecisionJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class BrowserSessionRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid RunId { get; set; }
    public string RuntimeReference { get; set; } = string.Empty;
    public string? ProtectedRecoveryState { get; set; }
    public DateTimeOffset? RecoveryStateExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ArtifactRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid? RunId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string MediaType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
}

public sealed class ModelEvaluationRecord
{
    public Guid Id { get; set; }
    public string ModelId { get; set; } = string.Empty;
    public string Revision { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string TaskDefinitionVersion { get; set; } = string.Empty;
    public string OutputSchemaVersion { get; set; } = string.Empty;
    public string MetricsJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class SensitiveAnswerApprovalRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid RunId { get; set; }
    public Guid ProfileId { get; set; }
    public string ControlId { get; set; } = string.Empty;
    public string SourcePath { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string MaskedValue { get; set; } = string.Empty;
    public SensitiveApprovalState State { get; set; }
    public Guid ProfileConcurrencyToken { get; set; }
    public Guid ConcurrencyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
}

public enum ApiIdempotencyState
{
    InProgress,
    Completed,
}

public sealed class ApiIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public ApiIdempotencyState State { get; set; }
    public int? StatusCode { get; set; }
    public string? ContentType { get; set; }
    public string? ProtectedResponseBody { get; set; }
    public string? ETag { get; set; }
    public string? Location { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}

public sealed class UserSettingRecord
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Key { get; set; } = string.Empty;
    public int SchemaVersion { get; set; }
    public string ContentJson { get; set; } = "{}";
    public Guid ConcurrencyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
