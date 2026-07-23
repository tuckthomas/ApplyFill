using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Api.Security;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Profiles;

namespace ResumeBuilder.Api.Controllers;

[Route("internal/v1/profile-answer-candidates")]
public sealed class InternalProfileAnswersController(
    IRelevantAnswerSource answerSource,
    ICurrentInstallation installation,
    IWorkerServiceTokenAuthenticator tokenAuthenticator) : ApiControllerBase
{
    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(262_144)]
    public async Task<ActionResult<RelevantAnswersResponse>> Find(
        RelevantAnswersRequest request,
        CancellationToken cancellationToken)
    {
        if (!tokenAuthenticator.IsConfigured)
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "The private browser-worker connection is not configured.",
                type: "https://applyfill.local/problems/worker-token-not-configured",
                extensions: new Dictionary<string, object?> { ["code"] = "worker-token-not-configured" });
        }

        if (!tokenAuthenticator.IsAuthorized(Request.Headers["X-ApplyFill-Worker-Token"]))
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "The browser worker could not be authenticated.",
                Type = "https://applyfill.local/problems/worker-authentication-failed",
                Extensions = { ["code"] = "worker-authentication-failed" },
            });
        }

        var controls = request.Controls.Select(x => new VisibleFormControl(
            x.ControlId,
            x.Label,
            x.Role,
            x.Autocomplete,
            x.Options)).ToArray();
        var candidates = await answerSource.FindCandidatesAsync(
            installation.Id,
            new RelevantAnswerQuery(request.ProfileId, controls),
            cancellationToken);
        return new RelevantAnswersResponse(candidates);
    }
}

public sealed record RelevantAnswersRequest(Guid ProfileId, IReadOnlyList<VisibleControlRequest> Controls);

public sealed record VisibleControlRequest(
    string ControlId,
    string Label,
    string Role,
    string? Autocomplete,
    IReadOnlyList<string>? Options);

public sealed record RelevantAnswersResponse(IReadOnlyList<RelevantAnswerCandidate> Candidates);
