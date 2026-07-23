using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Api.Security;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;

namespace ResumeBuilder.Api.Controllers;

[Route("api/internal/v1/application-runs")]
public sealed class InternalApplicationRunsController(
    IWorkerRunPersistence persistence,
    ICurrentInstallation installation,
    IWorkerServiceTokenAuthenticator tokenAuthenticator) : ApiControllerBase
{
    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(64 * 1024)]
    public async Task<ActionResult<PersistentRunProjection>> Start(
        PersistWorkerRunRequest request,
        CancellationToken cancellationToken)
    {
        var unauthorized = AuthorizeWorker();
        if (unauthorized is not null)
        {
            return unauthorized;
        }

        var value = await persistence.StartOrGetAsync(installation.Id, request, cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return value;
    }

    [HttpGet("{runId:guid}")]
    public async Task<ActionResult<PersistentRunProjection>> Get(
        Guid runId,
        CancellationToken cancellationToken)
    {
        var unauthorized = AuthorizeWorker();
        if (unauthorized is not null)
        {
            return unauthorized;
        }

        var value = await persistence.FindAsync(installation.Id, runId, cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(value.ConcurrencyToken);
        return value;
    }

    [HttpGet("recoverable")]
    public async Task<ActionResult<IReadOnlyList<PersistentRunProjection>>> ListRecoverable(
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var unauthorized = AuthorizeWorker();
        if (unauthorized is not null)
        {
            return unauthorized;
        }

        return Ok(await persistence.ListRecoverableAsync(installation.Id, take, cancellationToken));
    }

    [HttpPost("{runId:guid}/checkpoints")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(128 * 1024)]
    public async Task<ActionResult<PersistentRunProjection>> Checkpoint(
        Guid runId,
        PersistWorkerCheckpointRequest request,
        CancellationToken cancellationToken)
    {
        var unauthorized = AuthorizeWorker();
        if (unauthorized is not null)
        {
            return unauthorized;
        }

        var value = await persistence.UpdateAndCheckpointAsync(
            installation.Id,
            runId,
            request,
            cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(value.ConcurrencyToken);
        return value;
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
