using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/profiles/current/source-resume")]
public sealed class ProfileSourceResumeController(
    IProfileSourceResumeRepository sourceResumes,
    IArtifactStore artifactStore,
    ICurrentInstallation installation,
    IIdentifierGenerator identifiers,
    IClock clock) : ApiControllerBase
{
    private const long MaximumBytes = 10 * 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<ProfileSourceResumeResponse>> Get(CancellationToken cancellationToken)
    {
        var value = await sourceResumes.FindCurrentAsync(installation.Id, cancellationToken);
        return value is null ? NotFound() : ToResponse(value);
    }

    [HttpPut]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(MaximumBytes + 64 * 1024)]
    public async Task<ActionResult<ProfileSourceResumeResponse>> Put(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaximumBytes)
        {
            throw new ArgumentException("The resume must contain data and be no larger than 10 MB.");
        }

        var fileName = Path.GetFileName(file.FileName);
        var mediaType = ValidateMediaType(fileName, file.ContentType);
        await using var content = file.OpenReadStream();
        await ValidateMagicAsync(content, mediaType, cancellationToken);
        var id = identifiers.NewId();
        var stored = await artifactStore.PutAsync(
            installation.Id,
            id,
            fileName,
            mediaType,
            content,
            MaximumBytes,
            cancellationToken);
        var value = new ProfileSourceResume(
            id,
            installation.Id,
            fileName,
            mediaType,
            stored.SizeBytes,
            stored.Sha256,
            stored.StorageKey,
            clock.UtcNow);

        ProfileSourceResume? replaced;
        try
        {
            replaced = await sourceResumes.ReplaceAsync(value, cancellationToken);
        }
        catch
        {
            await artifactStore.DeleteAsync(installation.Id, stored.StorageKey, CancellationToken.None);
            throw;
        }

        if (replaced is not null)
        {
            await artifactStore.DeleteAsync(installation.Id, replaced.StorageKey, cancellationToken);
        }

        return ToResponse(value);
    }

    [HttpGet("content")]
    public async Task<IActionResult> Download(CancellationToken cancellationToken)
    {
        var value = await sourceResumes.FindCurrentAsync(installation.Id, cancellationToken);
        if (value is null) return NotFound();
        var content = await artifactStore.OpenReadAsync(installation.Id, value.StorageKey, cancellationToken);
        return content is null
            ? NotFound()
            : File(content, value.MediaType, value.FileName, enableRangeProcessing: true);
    }

    [HttpDelete]
    [EnableRateLimiting("commands")]
    public async Task<IActionResult> Delete(CancellationToken cancellationToken)
    {
        var value = await sourceResumes.DeleteAsync(installation.Id, cancellationToken);
        if (value is not null)
        {
            await artifactStore.DeleteAsync(installation.Id, value.StorageKey, cancellationToken);
        }
        return NoContent();
    }

    private static ProfileSourceResumeResponse ToResponse(ProfileSourceResume value) => new(
        value.Id,
        value.FileName,
        value.MediaType,
        value.SizeBytes,
        value.Sha256,
        value.CreatedAt);

    private static string ValidateMediaType(string fileName, string suppliedMediaType)
    {
        var extension = Path.GetExtension(fileName);
        if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase)
            && suppliedMediaType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return "application/pdf";
        }

        const string docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (extension.Equals(".docx", StringComparison.OrdinalIgnoreCase)
            && suppliedMediaType.Equals(docx, StringComparison.OrdinalIgnoreCase))
        {
            return docx;
        }

        if (extension.Equals(".txt", StringComparison.OrdinalIgnoreCase)
            && suppliedMediaType.StartsWith("text/plain", StringComparison.OrdinalIgnoreCase))
        {
            return "text/plain";
        }

        throw new ArgumentException("Only PDF, DOCX, and plain-text resumes are accepted.");
    }

    private static async Task ValidateMagicAsync(
        Stream content,
        string mediaType,
        CancellationToken cancellationToken)
    {
        var header = new byte[4];
        var count = await content.ReadAsync(header, cancellationToken);
        content.Position = 0;
        var valid = mediaType switch
        {
            "application/pdf" => count == 4 && header.AsSpan().SequenceEqual("%PDF"u8),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" =>
                count >= 2 && header[0] == (byte)'P' && header[1] == (byte)'K',
            "text/plain" => !header.Take(count).Any(value => value == 0),
            _ => false,
        };
        if (!valid) throw new ArgumentException("The resume contents do not match its file type.");
    }
}

public sealed record ProfileSourceResumeResponse(
    Guid Id,
    string FileName,
    string MediaType,
    long SizeBytes,
    string Sha256,
    DateTimeOffset CreatedAt);
