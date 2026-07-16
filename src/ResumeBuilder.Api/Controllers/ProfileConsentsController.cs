using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Domain;
using ResumeBuilder.Domain.Entities;
using ResumeBuilder.Infrastructure.Data;

namespace ResumeBuilder.Api.Controllers;

[ApiController]
[Route("api/profile-consents")]
public class ProfileConsentsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public ProfileConsentsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("current")]
    public async Task<ActionResult<ProfileConsentResponse>> GetCurrentConsent(CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        var consent = await _dbContext.ProfileConsents
            .Where(candidate => candidate.UserProfile.UserId == userId
                && candidate.ConsentType == ProfileConsentTerms.ConsentType
                && candidate.DisclosureVersion == ProfileConsentTerms.DisclosureVersion)
            .SingleOrDefaultAsync(cancellationToken);

        return consent is null ? NotFound() : Ok(ToResponse(consent));
    }

    [HttpPost]
    public async Task<ActionResult<ProfileConsentResponse>> RecordConsent(
        [FromBody] RecordProfileConsentRequest request,
        CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        if (!request.Accepted) return BadRequest("Affirmative consent is required.");
        if (!string.Equals(request.DisclosureVersion, ProfileConsentTerms.DisclosureVersion, StringComparison.Ordinal))
        {
            return Conflict("The disclosure has changed. Reload the page and review the current version.");
        }

        var profile = await _dbContext.UserProfiles
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);

        if (profile is null)
        {
            profile = new UserProfile
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.UserProfiles.Add(profile);
        }

        var existingConsent = await _dbContext.ProfileConsents.SingleOrDefaultAsync(
            consent => consent.UserProfileId == profile.Id
                && consent.ConsentType == ProfileConsentTerms.ConsentType
                && consent.DisclosureVersion == ProfileConsentTerms.DisclosureVersion,
            cancellationToken);

        if (existingConsent is not null) return Ok(ToResponse(existingConsent));

        var consentRecord = new ProfileConsent
        {
            Id = Guid.NewGuid(),
            UserProfile = profile,
            ConsentType = ProfileConsentTerms.ConsentType,
            DisclosureVersion = ProfileConsentTerms.DisclosureVersion,
            DisclosureText = ProfileConsentTerms.DisclosureText,
            DisclosureSha256 = ComputeSha256(ProfileConsentTerms.DisclosureText),
            CaptureMethod = ProfileConsentTerms.CaptureMethod,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
            ConsentedAtUtc = DateTime.UtcNow
        };

        _dbContext.ProfileConsents.Add(consentRecord);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(consentRecord));
    }

    private static string ComputeSha256(string value) => Convert.ToHexString(
        SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static ProfileConsentResponse ToResponse(ProfileConsent consent) => new(
        consent.Id,
        consent.DisclosureVersion,
        consent.DisclosureText,
        consent.DisclosureSha256,
        consent.CaptureMethod,
        consent.ConsentedAtUtc);
}

public sealed record RecordProfileConsentRequest(bool Accepted, string DisclosureVersion);

public sealed record ProfileConsentResponse(
    Guid ConsentId,
    string DisclosureVersion,
    string DisclosureText,
    string DisclosureSha256,
    string CaptureMethod,
    DateTime ConsentedAtUtc);
