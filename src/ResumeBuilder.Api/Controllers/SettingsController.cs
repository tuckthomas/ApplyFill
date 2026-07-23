using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/settings")]
public sealed class SettingsController(
    IUserSettingRepository settings,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers) : ApiControllerBase
{
    private const int MaximumRequestBytes = 256 * 1024;
    private static readonly HashSet<string> AllowedKeys = new(StringComparer.Ordinal)
    {
        "dashboard",
        "date-format",
    };

    [HttpGet("{key}")]
    public async Task<ActionResult<UserSettingResponse>> Get(
        string key,
        CancellationToken cancellationToken)
    {
        var normalizedKey = ValidateKey(key);
        var resource = await settings.FindAsync(installation.Id, normalizedKey, cancellationToken);
        if (resource is null)
        {
            return NotFound();
        }

        SetConcurrencyToken(resource.ConcurrencyToken);
        return ToResponse(resource);
    }

    [HttpPut("{key}")]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(MaximumRequestBytes)]
    public async Task<ActionResult<UserSettingResponse>> Put(
        string key,
        SaveUserSettingRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedKey = ValidateKey(key);
        ArgumentOutOfRangeException.ThrowIfLessThan(request.SchemaVersion, 1);
        var content = StructuredJsonValidator.ValidateAndNormalize(request.Content, MaximumRequestBytes);
        var existing = await settings.FindAsync(installation.Id, normalizedKey, cancellationToken);
        var now = clock.UtcNow;
        Guid? expectedToken = null;
        UserSettingResource resource;
        if (existing is null)
        {
            if (Request.Headers.IfMatch.Count > 0)
            {
                throw new ConcurrencyConflictException(nameof(UserSettingResource), Guid.Empty);
            }

            resource = new UserSettingResource(
                identifiers.NewId(),
                installation.Id,
                normalizedKey,
                request.SchemaVersion,
                content,
                identifiers.NewId(),
                now,
                now);
        }
        else
        {
            expectedToken = RequireConcurrencyToken();
            resource = existing with
            {
                SchemaVersion = request.SchemaVersion,
                ContentJson = content,
                ConcurrencyToken = identifiers.NewId(),
                UpdatedAt = now,
            };
        }

        await settings.SaveAsync(resource, expectedToken, cancellationToken);
        SetConcurrencyToken(resource.ConcurrencyToken);
        return ToResponse(resource);
    }

    private static string ValidateKey(string key)
    {
        var normalized = key.Trim().ToLowerInvariant();
        return AllowedKeys.Contains(normalized)
            ? normalized
            : throw new ArgumentException("That settings resource is not supported.", nameof(key));
    }

    private static UserSettingResponse ToResponse(UserSettingResource resource)
    {
        using var document = JsonDocument.Parse(resource.ContentJson);
        return new UserSettingResponse(
            resource.Key,
            resource.SchemaVersion,
            document.RootElement.Clone(),
            resource.ConcurrencyToken,
            resource.UpdatedAt);
    }
}

public sealed record SaveUserSettingRequest(int SchemaVersion, JsonElement Content);

public sealed record UserSettingResponse(
    string Key,
    int SchemaVersion,
    JsonElement Content,
    Guid ConcurrencyToken,
    DateTimeOffset UpdatedAt);
