using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/credential-vault")]
public sealed class CredentialVaultController(
    ApplyFillDbContext dbContext,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers,
    ICredentialVaultService vault) : ApiControllerBase
{
    [HttpGet]
    public async Task<VaultStatusResponse> Status(CancellationToken cancellationToken) =>
        new(await dbContext.CredentialVaults.AnyAsync(x => x.OwnerId == installation.Id, cancellationToken),
            vault.IsUnlocked(installation.Id));

    [HttpPost("setup")]
    [EnableRateLimiting("commands")]
    public async Task<ActionResult<VaultStatusResponse>> Setup(VaultPasswordRequest request, CancellationToken cancellationToken)
    {
        if (await dbContext.CredentialVaults.AnyAsync(x => x.OwnerId == installation.Id, cancellationToken))
            return Conflict(new ProblemDetails { Status = 409, Title = "The credential vault is already configured." });
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
            return BadRequest(new ProblemDetails { Status = 400, Title = "Use at least 12 characters for the vault password." });

        var salt = RandomNumberGenerator.GetBytes(16);
        var key = vault.CreateKey(request.Password, salt);
        var now = clock.UtcNow;
        dbContext.CredentialVaults.Add(new CredentialVaultRecord
        {
            Id = identifiers.NewId(),
            OwnerId = installation.Id,
            Salt = Convert.ToBase64String(salt),
            VerificationCiphertext = vault.Encrypt(key, "ApplyFill credential vault", VerificationContext()),
            CreatedAt = now,
            UpdatedAt = now,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        vault.Unlock(installation.Id, key);
        return new VaultStatusResponse(true, true);
    }

    [HttpPost("unlock")]
    [EnableRateLimiting("commands")]
    public async Task<ActionResult<VaultStatusResponse>> Unlock(VaultPasswordRequest request, CancellationToken cancellationToken)
    {
        var configuration = await dbContext.CredentialVaults.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == installation.Id, cancellationToken)
            ?? throw new InvalidOperationException("Set up the credential vault first.");
        var key = vault.CreateKey(request.Password, Convert.FromBase64String(configuration.Salt));
        if (!vault.TryDecrypt(key, configuration.VerificationCiphertext, VerificationContext(), out var verifier)
            || verifier != "ApplyFill credential vault")
        {
            CryptographicOperations.ZeroMemory(key);
            return UnprocessableEntity(new ProblemDetails { Status = 422, Title = "The vault password is incorrect." });
        }
        vault.Unlock(installation.Id, key);
        return new VaultStatusResponse(true, true);
    }

    [HttpPost("lock")]
    public VaultStatusResponse Lock()
    {
        vault.Lock(installation.Id);
        return new(true, false);
    }

    [HttpGet("companies/{companyId:guid}/credentials")]
    public async Task<IReadOnlyList<CredentialResponse>> List(Guid companyId, CancellationToken cancellationToken)
    {
        await RequireCompany(companyId, cancellationToken);
        return await dbContext.CompanyCredentials.AsNoTracking()
            .Where(x => x.OwnerId == installation.Id && x.CompanyId == companyId)
            .OrderBy(x => x.Label)
            .Select(x => new CredentialResponse(x.Id, x.CompanyId, x.Label, x.Username, x.LoginUrl, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    [HttpPost("companies/{companyId:guid}/credentials")]
    [EnableRateLimiting("commands")]
    public async Task<ActionResult<CredentialResponse>> Create(
        Guid companyId,
        SaveCredentialRequest request,
        CancellationToken cancellationToken)
    {
        await RequireCompany(companyId, cancellationToken);
        if (!vault.IsUnlocked(installation.Id))
            return Problem(statusCode: StatusCodes.Status423Locked, title: "Unlock the credential vault first.");
        var id = identifiers.NewId();
        var now = clock.UtcNow;
        var record = new CompanyCredentialRecord
        {
            Id = id,
            OwnerId = installation.Id,
            CompanyId = companyId,
            Label = Required(request.Label, 120),
            Username = Required(request.Username, 320),
            LoginUrl = ValidateUrl(request.LoginUrl),
            ProtectedPassword = vault.Encrypt(installation.Id, request.Password, CredentialContext(id)),
            CreatedAt = now,
            UpdatedAt = now,
        };
        dbContext.CompanyCredentials.Add(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, ToResponse(record));
    }

    [HttpDelete("credentials/{id:guid}")]
    [EnableRateLimiting("commands")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var record = await dbContext.CompanyCredentials.SingleOrDefaultAsync(
            x => x.OwnerId == installation.Id && x.Id == id, cancellationToken);
        if (record is null) return NoContent();
        dbContext.CompanyCredentials.Remove(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task RequireCompany(Guid companyId, CancellationToken cancellationToken)
    {
        if (!await dbContext.Companies.AnyAsync(
            x => x.OwnerId == installation.Id && x.Id == companyId, cancellationToken))
            throw new KeyNotFoundException("Company not found.");
    }

    private static string Required(string value, int maximum)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        value = value.Trim();
        return value.Length <= maximum ? value : throw new ValidationException("The value is too long.");
    }

    private static string ValidateUrl(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        return Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? uri.AbsoluteUri
            : throw new ValidationException("Enter a valid HTTP or HTTPS login URL.");
    }

    private string VerificationContext() => $"vault:{installation.Id:N}:verification";
    private static string CredentialContext(Guid id) => $"credential:{id:N}";
    private static CredentialResponse ToResponse(CompanyCredentialRecord value) =>
        new(value.Id, value.CompanyId, value.Label, value.Username, value.LoginUrl, value.CreatedAt, value.UpdatedAt);
}

public sealed record VaultPasswordRequest(string Password);
public sealed record VaultStatusResponse(bool IsConfigured, bool IsUnlocked);
public sealed record SaveCredentialRequest(string Label, string Username, string Password, string LoginUrl);
public sealed record CredentialResponse(
    Guid Id,
    Guid CompanyId,
    string Label,
    string Username,
    string LoginUrl,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
