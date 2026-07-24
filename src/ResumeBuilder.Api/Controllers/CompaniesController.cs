using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Infrastructure.Persistence;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/companies")]
public sealed partial class CompaniesController(
    ApplyFillDbContext dbContext,
    ICurrentInstallation installation,
    IClock clock,
    IIdentifierGenerator identifiers) : ApiControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<CompanyResponse>> List(CancellationToken cancellationToken)
    {
        return await dbContext.Companies.AsNoTracking()
            .Where(x => x.OwnerId == installation.Id)
            .OrderBy(x => x.Name)
            .Select(x => new CompanyResponse(x.Id, x.Name, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    [HttpPost]
    [EnableRateLimiting("commands")]
    public async Task<ActionResult<CompanyResponse>> Create(
        SaveCompanyRequest request,
        CancellationToken cancellationToken)
    {
        var name = ValidateName(request.Name);
        var normalized = NormalizeName(name);
        var existing = await dbContext.Companies.SingleOrDefaultAsync(
            x => x.OwnerId == installation.Id && x.NormalizedName == normalized,
            cancellationToken);
        if (existing is not null)
        {
            return Ok(ToResponse(existing));
        }

        var now = clock.UtcNow;
        var company = new CompanyRecord
        {
            Id = identifiers.NewId(),
            OwnerId = installation.Id,
            Name = name,
            NormalizedName = normalized,
            CreatedAt = now,
            UpdatedAt = now,
        };
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(List), ToResponse(company));
    }

    internal static string NormalizeName(string value) =>
        Whitespace().Replace(value.Trim(), " ").ToUpperInvariant();

    internal static async Task<CompanyRecord> FindOrCreateAsync(
        ApplyFillDbContext dbContext,
        Guid ownerId,
        string rawName,
        IClock clock,
        IIdentifierGenerator identifiers,
        CancellationToken cancellationToken)
    {
        var name = ValidateName(rawName);
        var normalized = NormalizeName(name);
        var existing = await dbContext.Companies.SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.NormalizedName == normalized,
            cancellationToken);
        if (existing is not null) return existing;

        var now = clock.UtcNow;
        var company = new CompanyRecord
        {
            Id = identifiers.NewId(),
            OwnerId = ownerId,
            Name = name,
            NormalizedName = normalized,
            CreatedAt = now,
            UpdatedAt = now,
        };
        dbContext.Companies.Add(company);
        return company;
    }

    private static string ValidateName(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var name = Whitespace().Replace(value.Trim(), " ");
        return name.Length <= 200 ? name : throw new ValidationException("Company name is too long.");
    }

    private static CompanyResponse ToResponse(CompanyRecord value) =>
        new(value.Id, value.Name, value.CreatedAt, value.UpdatedAt);

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

public sealed record SaveCompanyRequest(string Name);
public sealed record CompanyResponse(Guid Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
