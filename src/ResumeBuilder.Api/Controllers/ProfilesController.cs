using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Domain.Profiles;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/profiles")]
public sealed class ProfilesController(
    IProfileRepository profiles,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers,
    ISensitiveValueProtector protector) : ApiControllerBase
{
    [HttpGet("current")]
    public async Task<ActionResult<ProfileResponse>> GetCurrent(CancellationToken cancellationToken)
    {
        var profile = await profiles.FindCurrentAsync(installation.Id, cancellationToken);
        if (profile is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(profile.ConcurrencyToken);
        return ToResponse(profile);
    }

    [HttpPut("current")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(1_048_576)]
    public async Task<ActionResult<ProfileResponse>> PutCurrent(
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(request.SchemaVersion, 1);
        StructuredJsonValidator.RejectSensitiveProfileFields(request.Content);
        var content = StructuredJsonValidator.ValidateAndNormalize(request.Content);
        var protectedData = request.SensitiveApplicationData is { } sensitive
            ? protector.Protect(StructuredJsonValidator.ValidateAndNormalize(sensitive, 128 * 1024))
            : null;

        var existing = await profiles.FindCurrentAsync(installation.Id, cancellationToken);
        Profile profile;
        Guid? expectedToken = null;
        if (existing is null)
        {
            var now = clock.UtcNow;
            profile = new Profile(
                identifiers.NewId(),
                installation.Id,
                request.SchemaVersion,
                content,
                protectedData,
                identifiers.NewId(),
                now,
                now);
        }
        else
        {
            expectedToken = RequireConcurrencyToken();
            existing.Update(request.SchemaVersion, content, protectedData ?? existing.ProtectedApplicationData, clock.UtcNow);
            profile = existing;
        }

        await profiles.SaveAsync(profile, expectedToken, cancellationToken);
        SetConcurrencyToken(profile.ConcurrencyToken);
        return ToResponse(profile);
    }

    [HttpPost("current/reveal-sensitive")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(4 * 1024)]
    public async Task<ActionResult<SensitiveApplicationDataResponse>> RevealSensitive(CancellationToken cancellationToken)
    {
        if (!string.Equals(Request.Headers["X-ApplyFill-Sensitive-Action"], "reveal", StringComparison.Ordinal))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Explicit sensitive-data confirmation is required.",
                Type = "https://applyfill.local/problems/sensitive-confirmation-required",
                Extensions = { ["code"] = "sensitive-confirmation-required" },
            });
        }

        var profile = await profiles.FindCurrentAsync(installation.Id, cancellationToken);
        if (profile?.ProtectedApplicationData is null)
        {
            return NotFound();
        }

        using var document = JsonDocument.Parse(protector.Unprotect(profile.ProtectedApplicationData));
        return new SensitiveApplicationDataResponse(document.RootElement.Clone());
    }

    private static ProfileResponse ToResponse(Profile profile)
    {
        using var document = JsonDocument.Parse(profile.ContentJson);
        return new ProfileResponse(
            profile.Id,
            profile.SchemaVersion,
            document.RootElement.Clone(),
            profile.ProtectedApplicationData is not null,
            profile.ConcurrencyToken,
            profile.UpdatedAt);
    }
}

public sealed record UpdateProfileRequest(
    int SchemaVersion,
    JsonElement Content,
    JsonElement? SensitiveApplicationData);

public sealed record ProfileResponse(
    Guid Id,
    int SchemaVersion,
    JsonElement Content,
    bool HasSensitiveApplicationData,
    Guid ConcurrencyToken,
    DateTimeOffset UpdatedAt);

public sealed record SensitiveApplicationDataResponse(JsonElement Content);
