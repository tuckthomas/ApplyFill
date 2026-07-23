using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Api.Controllers;

[Route("api/v1/resumes/{resumeId:guid}/artifacts")]
public sealed class ResumeArtifactsController(
    IResumeRepository resumes,
    IResumeArtifactRepository artifacts,
    IArtifactStore artifactStore,
    ICurrentInstallation installation,
    IIdentifierGenerator identifiers,
    IClock clock) : ApiControllerBase
{
    private const long MaximumArtifactBytes = 16 * 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ResumeArtifactResponse>>> List(
        Guid resumeId,
        CancellationToken cancellationToken)
    {
        if (await resumes.FindAsync(installation.Id, resumeId, cancellationToken) is null)
        {
            return NotFound();
        }

        var values = await artifacts.ListAsync(installation.Id, resumeId, cancellationToken);
        return values.Select(ToResponse).ToArray();
    }

    [HttpPost]
    [EnableRateLimiting("commands")]
    [RequestSizeLimit(MaximumArtifactBytes + 64 * 1024)]
    public async Task<ActionResult<ResumeArtifactResponse>> Upload(
        Guid resumeId,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (await resumes.FindAsync(installation.Id, resumeId, cancellationToken) is null)
        {
            return NotFound();
        }

        if (file.Length is <= 0 or > MaximumArtifactBytes)
        {
            throw new ArgumentException("Resume artifacts must contain data and be no larger than 16 MB.");
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
            MaximumArtifactBytes,
            cancellationToken);
        var artifact = new ResumeArtifact(
            id,
            installation.Id,
            resumeId,
            fileName,
            mediaType,
            stored.SizeBytes,
            stored.Sha256,
            stored.StorageKey,
            clock.UtcNow);
        try
        {
            await artifacts.AddAsync(artifact, cancellationToken);
        }
        catch
        {
            await artifactStore.DeleteAsync(installation.Id, stored.StorageKey, CancellationToken.None);
            throw;
        }

        return CreatedAtAction(nameof(GetMetadata), new { resumeId, id }, ToResponse(artifact));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ResumeArtifactResponse>> GetMetadata(
        Guid resumeId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var artifact = await artifacts.FindAsync(installation.Id, resumeId, id, cancellationToken);
        return artifact is null ? NotFound() : ToResponse(artifact);
    }

    [HttpGet("{id:guid}/content")]
    public async Task<IActionResult> Download(Guid resumeId, Guid id, CancellationToken cancellationToken)
    {
        var artifact = await artifacts.FindAsync(installation.Id, resumeId, id, cancellationToken);
        if (artifact is null)
        {
            return NotFound();
        }

        var content = await artifactStore.OpenReadAsync(installation.Id, artifact.StorageKey, cancellationToken);
        return content is null
            ? NotFound()
            : File(content, artifact.MediaType, artifact.FileName, enableRangeProcessing: true);
    }

    [HttpDelete("{id:guid}")]
    [EnableRateLimiting("commands")]
    public async Task<IActionResult> Delete(Guid resumeId, Guid id, CancellationToken cancellationToken)
    {
        var artifact = await artifacts.DeleteAsync(installation.Id, resumeId, id, cancellationToken);
        if (artifact is not null)
        {
            await artifactStore.DeleteAsync(installation.Id, artifact.StorageKey, cancellationToken);
        }

        return NoContent();
    }

    private static ResumeArtifactResponse ToResponse(ResumeArtifact value) => new(
        value.Id,
        value.ResumeId,
        value.FileName,
        value.MediaType,
        value.SizeBytes,
        value.Sha256,
        value.CreatedAt);

    private static string ValidateMediaType(string fileName, string suppliedMediaType)
    {
        var extension = Path.GetExtension(fileName);
        if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase) &&
            suppliedMediaType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return "application/pdf";
        }

        const string docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (extension.Equals(".docx", StringComparison.OrdinalIgnoreCase) &&
            suppliedMediaType.Equals(docx, StringComparison.OrdinalIgnoreCase))
        {
            return docx;
        }

        throw new ArgumentException("Only PDF and DOCX resume artifacts are accepted.");
    }

    private static async Task ValidateMagicAsync(Stream content, string mediaType, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        var count = await content.ReadAsync(header, cancellationToken);
        content.Position = 0;
        var valid = mediaType == "application/pdf"
            ? count == 4 && header.AsSpan().SequenceEqual("%PDF"u8)
            : count >= 2 && header[0] == (byte)'P' && header[1] == (byte)'K';
        if (!valid)
        {
            throw new ArgumentException("The artifact contents do not match its file type.");
        }
    }
}

public sealed record ResumeArtifactResponse(
    Guid Id,
    Guid ResumeId,
    string FileName,
    string MediaType,
    long SizeBytes,
    string Sha256,
    DateTimeOffset CreatedAt);
