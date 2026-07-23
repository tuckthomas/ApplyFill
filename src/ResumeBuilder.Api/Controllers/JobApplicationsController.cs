using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Domain.JobApplications;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/job-applications")]
public sealed class JobApplicationsController(
    IJobApplicationRepository applications,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers) : ApiControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<JobApplicationResponse>> List(
        [FromQuery] JobApplicationStatus? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        ValidatePage(skip, take);
        var values = await applications.ListAsync(installation.Id, status, skip, take, cancellationToken);
        return values.Select(ToResponse).ToArray();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<JobApplicationResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var value = await applications.FindAsync(installation.Id, id, cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(value.ConcurrencyToken);
        return ToResponse(value);
    }

    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(512 * 1024)]
    public async Task<ActionResult<JobApplicationResponse>> Create(
        SaveJobApplicationRequest request,
        CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var value = new JobApplication(
            identifiers.NewId(),
            installation.Id,
            ValidateText(request.Company, nameof(request.Company)),
            ValidateText(request.JobTitle, nameof(request.JobTitle)),
            ValidateTarget(request.TargetUrl),
            request.Status,
            StructuredJsonValidator.ValidateAndNormalize(request.Details, 256 * 1024),
            identifiers.NewId(),
            now,
            now);
        await applications.SaveAsync(value, null, cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return CreatedAtAction(nameof(Get), new { id = value.Id }, ToResponse(value));
    }

    [HttpPut("{id:guid}")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(512 * 1024)]
    public async Task<ActionResult<JobApplicationResponse>> Update(
        Guid id,
        SaveJobApplicationRequest request,
        CancellationToken cancellationToken)
    {
        var value = await applications.FindAsync(installation.Id, id, cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        var expected = RequireConcurrencyToken();
        value.Update(
            ValidateText(request.Company, nameof(request.Company)),
            ValidateText(request.JobTitle, nameof(request.JobTitle)),
            ValidateTarget(request.TargetUrl),
            request.Status,
            StructuredJsonValidator.ValidateAndNormalize(request.Details, 256 * 1024),
            clock.UtcNow);
        await applications.SaveAsync(value, expected, cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return ToResponse(value);
    }

    [HttpDelete("{id:guid}")]
    [EnableRateLimiting("commands")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await applications.DeleteAsync(installation.Id, id, RequireConcurrencyToken(), cancellationToken);
        return NoContent();
    }

    private static JobApplicationResponse ToResponse(JobApplication value)
    {
        using var json = JsonDocument.Parse(value.DetailsJson);
        return new JobApplicationResponse(
            value.Id,
            value.Company,
            value.JobTitle,
            value.Target.AbsoluteUri,
            value.Status,
            json.RootElement.Clone(),
            value.ConcurrencyToken,
            value.CreatedAt,
            value.UpdatedAt);
    }

    private static string ValidateText(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Length <= 200 ? value.Trim() : throw new ValidationException($"{parameterName} is too long.");
    }

    private static Uri ValidateTarget(string targetUrl)
    {
        var normalized = ProfileValueNormalizer.NormalizeUrl(targetUrl);
        return new Uri(normalized);
    }

    private static void ValidatePage(int skip, int take)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(skip);
        ArgumentOutOfRangeException.ThrowIfLessThan(take, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(take, 100);
    }
}

public sealed record SaveJobApplicationRequest(
    string Company,
    string JobTitle,
    string TargetUrl,
    JobApplicationStatus Status,
    JsonElement Details);

public sealed record JobApplicationResponse(
    Guid Id,
    string Company,
    string JobTitle,
    string TargetUrl,
    JobApplicationStatus Status,
    JsonElement Details,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
