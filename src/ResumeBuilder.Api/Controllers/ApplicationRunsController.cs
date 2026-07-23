using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Domain.ApplicationRuns;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/application-runs")]
public sealed class ApplicationRunsController(
    IApplicationRunRepository runs,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers) : ApiControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<ApplicationRunResponse>> List(
        [FromQuery] ApplicationRunStatus? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        ValidatePage(skip, take);
        var values = await runs.ListAsync(installation.Id, status, skip, take, cancellationToken);
        return values.Select(ToResponse).ToArray();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApplicationRunResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var value = await runs.FindAsync(installation.Id, id, cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(value.ConcurrencyToken);
        return ToResponse(value);
    }

    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(32 * 1024)]
    public async Task<ActionResult<ApplicationRunResponse>> Create(
        StartApplicationRunRequest request,
        CancellationToken cancellationToken)
    {
        if (request.JobApplicationId == Guid.Empty || request.ProfileId == Guid.Empty)
        {
            throw new ArgumentException("A job application and profile are required.");
        }

        var target = new Uri(ProfileValueNormalizer.NormalizeUrl(request.TargetUrl));
        var now = clock.UtcNow;
        var value = new ApplicationRun(
            identifiers.NewId(),
            installation.Id,
            request.JobApplicationId,
            request.ProfileId,
            request.ResumeId,
            target,
            ApplicationRunStatus.Created,
            "Ready to start",
            ControlOwner.Agent,
            0,
            null,
            identifiers.NewId(),
            now,
            now);
        await runs.SaveAsync(value, null, cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return CreatedAtAction(nameof(Get), new { id = value.Id }, ToResponse(value));
    }

    [HttpGet("{id:guid}/checkpoints")]
    public async Task<ActionResult<IReadOnlyList<RunCheckpointResponse>>> ListCheckpoints(
        Guid id,
        [FromQuery] long afterSequence = -1,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(afterSequence, -1);
        ArgumentOutOfRangeException.ThrowIfLessThan(take, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(take, 250);
        if (await runs.FindAsync(installation.Id, id, cancellationToken) is null)
        {
            return NotFound();
        }

        var values = await runs.ListCheckpointsAsync(installation.Id, id, afterSequence, take, cancellationToken);
        return values.Select(ToResponse).ToArray();
    }

    [HttpPost("{id:guid}/checkpoints")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(128 * 1024)]
    public async Task<ActionResult<RunCheckpointResponse>> AppendCheckpoint(
        Guid id,
        AppendRunCheckpointRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Sequence < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "Sequence must be non-negative.");
        }

        var run = await runs.FindAsync(installation.Id, id, cancellationToken);
        if (run is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.CurrentUrl))
        {
            _ = ProfileValueNormalizer.NormalizeUrl(request.CurrentUrl);
        }

        var checkpoint = new RunCheckpoint(
            identifiers.NewId(),
            installation.Id,
            id,
            request.Sequence,
            request.Status,
            request.Stage.Trim(),
            request.CurrentUrl,
            request.CurrentDomain,
            StructuredJsonValidator.ValidateAndNormalize(request.Summary, 64 * 1024),
            clock.UtcNow);
        await runs.AppendCheckpointAsync(checkpoint, cancellationToken);
        return CreatedAtAction(nameof(ListCheckpoints), new { id }, ToResponse(checkpoint));
    }

    private static ApplicationRunResponse ToResponse(ApplicationRun value) => new(
        value.Id,
        value.JobApplicationId,
        value.ProfileId,
        value.ResumeId,
        value.Target.AbsoluteUri,
        value.Status,
        value.Stage,
        value.ControlOwner,
        value.RetryCount,
        value.ConcurrencyToken,
        value.CreatedAt,
        value.UpdatedAt);

    private static RunCheckpointResponse ToResponse(RunCheckpoint value)
    {
        using var json = JsonDocument.Parse(value.SummaryJson);
        return new RunCheckpointResponse(
            value.Id,
            value.Sequence,
            value.Status,
            value.Stage,
            value.CurrentUrl,
            value.CurrentDomain,
            json.RootElement.Clone(),
            value.CreatedAt);
    }

    private static void ValidatePage(int skip, int take)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(skip);
        ArgumentOutOfRangeException.ThrowIfLessThan(take, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(take, 100);
    }
}

public sealed record StartApplicationRunRequest(
    Guid JobApplicationId,
    Guid ProfileId,
    Guid? ResumeId,
    string TargetUrl);

public sealed record ApplicationRunResponse(
    Guid Id,
    Guid JobApplicationId,
    Guid ProfileId,
    Guid? ResumeId,
    string TargetUrl,
    ApplicationRunStatus Status,
    string Stage,
    ControlOwner ControlOwner,
    int RetryCount,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record AppendRunCheckpointRequest(
    long Sequence,
    ApplicationRunStatus Status,
    string Stage,
    string? CurrentUrl,
    string? CurrentDomain,
    JsonElement Summary);

public sealed record RunCheckpointResponse(
    Guid Id,
    long Sequence,
    ApplicationRunStatus Status,
    string Stage,
    string? CurrentUrl,
    string? CurrentDomain,
    JsonElement Summary,
    DateTimeOffset CreatedAt);
