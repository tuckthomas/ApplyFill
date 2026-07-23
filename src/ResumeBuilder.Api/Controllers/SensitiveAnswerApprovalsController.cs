using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Profiles;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/application-runs/{runId:guid}/sensitive-approvals")]
public sealed class SensitiveAnswerApprovalsController(
    ISensitiveAnswerApprovalService approvals,
    ICurrentInstallation installation) : ApiControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<SensitiveApprovalResponse>> List(
        Guid runId,
        CancellationToken cancellationToken)
    {
        var values = await approvals.ListAsync(installation.Id, runId, cancellationToken);
        return values.Select(ToResponse).ToArray();
    }

    [HttpPost("{approvalId:guid}/decision")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(16 * 1024)]
    public async Task<ActionResult<SensitiveApprovalResponse>> Decide(
        Guid runId,
        Guid approvalId,
        SensitiveApprovalDecisionRequest request,
        CancellationToken cancellationToken)
    {
        var value = await approvals.DecideAsync(
            installation.Id,
            runId,
            approvalId,
            RequireConcurrencyToken(),
            request.Approved,
            cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(value.ConcurrencyToken);
        return ToResponse(value);
    }

    internal static SensitiveApprovalResponse ToResponse(SensitiveAnswerApproval value) => new(
        value.Id,
        value.RunId,
        value.ControlId,
        value.SourcePath,
        value.DisplayName,
        value.MaskedValue,
        value.State,
        value.ConcurrencyToken,
        value.CreatedAt,
        value.ExpiresAt,
        value.DecidedAt,
        value.ConsumedAt);
}

public sealed record SensitiveApprovalDecisionRequest(bool Approved);

public sealed record SensitiveApprovalResponse(
    Guid Id,
    Guid RunId,
    string ControlId,
    string SourcePath,
    string DisplayName,
    string MaskedValue,
    SensitiveApprovalState State,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? DecidedAt,
    DateTimeOffset? ConsumedAt);
