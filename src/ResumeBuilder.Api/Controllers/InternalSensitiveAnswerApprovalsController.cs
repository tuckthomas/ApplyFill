using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Api.Security;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Profiles;

namespace ResumeBuilder.Api.Controllers;

[Route("api/internal/v1/sensitive-answer-approvals")]
public sealed class InternalSensitiveAnswerApprovalsController(
    ISensitiveAnswerApprovalService approvals,
    ICurrentInstallation installation,
    IWorkerServiceTokenAuthenticator tokenAuthenticator) : ApiControllerBase
{
    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(32_768)]
    public async Task<ActionResult<SensitiveApprovalResponse>> RequestApproval(
        RequestSensitiveApproval request,
        CancellationToken cancellationToken)
    {
        var unauthorized = AuthorizeWorker();
        if (unauthorized is not null)
        {
            return unauthorized;
        }

        var value = await approvals.RequestAsync(
            installation.Id,
            new SensitiveApprovalRequest(
                request.RunId,
                request.ProfileId,
                request.ControlId,
                request.SourcePath,
                request.DisplayName),
            cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return SensitiveAnswerApprovalsController.ToResponse(value);
    }

    [HttpPost("{approvalId:guid}/consume")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(16_384)]
    public async Task<ActionResult<ConsumedSensitiveAnswerResponse>> Consume(
        Guid approvalId,
        ConsumeSensitiveApproval request,
        CancellationToken cancellationToken)
    {
        var unauthorized = AuthorizeWorker();
        if (unauthorized is not null)
        {
            return unauthorized;
        }

        var value = await approvals.ConsumeAsync(
            installation.Id,
            request.RunId,
            approvalId,
            request.ControlId,
            cancellationToken);
        return value is null
            ? NotFound()
            : new ConsumedSensitiveAnswerResponse(value.ApprovalId, value.ControlId, value.Value);
    }

    private ActionResult? AuthorizeWorker()
    {
        if (!tokenAuthenticator.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        return tokenAuthenticator.IsAuthorized(Request.Headers["X-ApplyFill-Worker-Token"])
            ? null
            : Unauthorized();
    }
}

public sealed record RequestSensitiveApproval(
    Guid RunId,
    Guid ProfileId,
    string ControlId,
    string SourcePath,
    string DisplayName);

public sealed record ConsumeSensitiveApproval(Guid RunId, string ControlId);

public sealed record ConsumedSensitiveAnswerResponse(Guid ApprovalId, string ControlId, string Value);
