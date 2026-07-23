using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/resumes")]
public sealed class ResumesController(
    IResumeRepository resumes,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers) : ApiControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<ResumeResponse>> List(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        ValidatePage(skip, take);
        var values = await resumes.ListAsync(installation.Id, skip, take, cancellationToken);
        return values.Select(ToResponse).ToArray();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ResumeResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var value = await resumes.FindAsync(installation.Id, id, cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(value.ConcurrencyToken);
        return ToResponse(value);
    }

    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(1_048_576)]
    public async Task<ActionResult<ResumeResponse>> Create(
        SaveResumeRequest request,
        CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var value = new Resume(
            identifiers.NewId(),
            installation.Id,
            ValidateName(request.Name),
            ValidateSchemaVersion(request.SchemaVersion),
            StructuredJsonValidator.ValidateAndNormalize(request.Content),
            identifiers.NewId(),
            now,
            now);
        await resumes.SaveAsync(value, null, cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return CreatedAtAction(nameof(Get), new { id = value.Id }, ToResponse(value));
    }

    [HttpPut("{id:guid}")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(1_048_576)]
    public async Task<ActionResult<ResumeResponse>> Update(
        Guid id,
        SaveResumeRequest request,
        CancellationToken cancellationToken)
    {
        var value = await resumes.FindAsync(installation.Id, id, cancellationToken);
        if (value is null)
        {
            return NotFound();
        }

        var expected = RequireConcurrencyToken();
        value.Update(
            ValidateName(request.Name),
            ValidateSchemaVersion(request.SchemaVersion),
            StructuredJsonValidator.ValidateAndNormalize(request.Content),
            clock.UtcNow);
        await resumes.SaveAsync(value, expected, cancellationToken);
        SetConcurrencyToken(value.ConcurrencyToken);
        return ToResponse(value);
    }

    [HttpDelete("{id:guid}")]
    [EnableRateLimiting("commands")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await resumes.DeleteAsync(installation.Id, id, RequireConcurrencyToken(), cancellationToken);
        return NoContent();
    }

    private static ResumeResponse ToResponse(Resume document)
    {
        using var json = JsonDocument.Parse(document.ContentJson);
        return new ResumeResponse(
            document.Id,
            document.Name,
            document.SchemaVersion,
            json.RootElement.Clone(),
            document.ConcurrencyToken,
            document.CreatedAt,
            document.UpdatedAt);
    }

    private static string ValidateName(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        return name.Length <= 160 ? name.Trim() : throw new ValidationException("Resume name is too long.");
    }

    private static int ValidateSchemaVersion(int schemaVersion)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(schemaVersion, 1);
        return schemaVersion;
    }

    private static void ValidatePage(int skip, int take)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(skip);
        ArgumentOutOfRangeException.ThrowIfLessThan(take, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(take, 100);
    }
}

public sealed record SaveResumeRequest(string Name, int SchemaVersion, JsonElement Content);

public sealed record ResumeResponse(
    Guid Id,
    string Name,
    int SchemaVersion,
    JsonElement Content,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
