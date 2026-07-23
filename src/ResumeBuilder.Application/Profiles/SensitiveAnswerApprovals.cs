namespace ResumeBuilder.Application.Profiles;

public enum SensitiveApprovalState
{
    Pending,
    Approved,
    Denied,
    Consumed,
    Expired,
}

public sealed record SensitiveAnswerApproval(
    Guid Id,
    Guid OwnerId,
    Guid RunId,
    Guid ProfileId,
    string ControlId,
    string SourcePath,
    string DisplayName,
    string MaskedValue,
    SensitiveApprovalState State,
    Guid ProfileConcurrencyToken,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? DecidedAt,
    DateTimeOffset? ConsumedAt);

public sealed record SensitiveApprovalRequest(
    Guid RunId,
    Guid ProfileId,
    string ControlId,
    string SourcePath,
    string DisplayName);

public sealed record ConsumedSensitiveAnswer(Guid ApprovalId, string ControlId, string Value);

public interface ISensitiveAnswerApprovalService
{
    Task<SensitiveAnswerApproval> RequestAsync(
        Guid ownerId,
        SensitiveApprovalRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<SensitiveAnswerApproval>> ListAsync(
        Guid ownerId,
        Guid runId,
        CancellationToken cancellationToken);

    Task<SensitiveAnswerApproval?> DecideAsync(
        Guid ownerId,
        Guid runId,
        Guid approvalId,
        Guid expectedToken,
        bool approved,
        CancellationToken cancellationToken);

    Task<ConsumedSensitiveAnswer?> ConsumeAsync(
        Guid ownerId,
        Guid runId,
        Guid approvalId,
        string controlId,
        CancellationToken cancellationToken);
}
