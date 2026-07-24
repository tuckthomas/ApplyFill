using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Api.Security;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Api.Controllers;

[Route("internal/v1/company-credentials")]
public sealed class InternalCompanyCredentialsController(
    ApplyFillDbContext dbContext,
    ICurrentInstallation installation,
    IWorkerServiceTokenAuthenticator tokenAuthenticator,
    ICredentialVaultService vault) : ApiControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<InternalCredentialResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!tokenAuthenticator.IsConfigured ||
            !tokenAuthenticator.IsAuthorized(Request.Headers["X-ApplyFill-Worker-Token"]))
            return Unauthorized();
        if (!vault.IsUnlocked(installation.Id))
            return Problem(statusCode: StatusCodes.Status423Locked, title: "Unlock the credential vault first.");

        var credential = await dbContext.CompanyCredentials.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == installation.Id && x.Id == id, cancellationToken);
        if (credential is null) return NotFound();
        return new InternalCredentialResponse(
            credential.Id,
            credential.Username,
            vault.Decrypt(installation.Id, credential.ProtectedPassword, $"credential:{credential.Id:N}"));
    }
}

public sealed record InternalCredentialResponse(Guid Id, string Username, string Password);
