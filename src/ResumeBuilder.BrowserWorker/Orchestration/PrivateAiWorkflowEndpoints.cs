using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public static class PrivateAiWorkflowEndpoints
{
    private const long MaximumRequestBytes = 36L * 1024 * 1024;

    public static IEndpointRouteBuilder MapPrivateAiWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/private-ai/resume-import", ImportResumeAsync)
            .WithMetadata(new RequestSizeLimitAttribute(MaximumRequestBytes));
        endpoints.MapPost("/api/private-ai/resume-tailoring", TailorResumeAsync)
            .WithMetadata(new RequestSizeLimitAttribute(512 * 1024));
        return endpoints;
    }

    private static async Task<IResult> ImportResumeAsync(
        HttpRequest request,
        PrivateAiResumeWorkflows workflows,
        CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
        {
            return Results.BadRequest(new { title = "Choose a resume file to import." });
        }

        var form = await request.ReadFormAsync(cancellationToken);
        var pages = form.Files.GetFiles("pages");
        var pageNumbers = form["pageNumbers"];
        var sourceKind = NormalizeSourceKind(form["sourceKind"].ToString());
        if (pages.Count == 0 || pageNumbers.Count != pages.Count || sourceKind is null)
        {
            return Results.BadRequest(new { title = "ApplyFill could not read the rendered resume pages." });
        }

        var renderedPages = new List<ResumeImportPage>(pages.Count);
        for (var index = 0; index < pages.Count; index++)
        {
            if (!int.TryParse(pageNumbers[index], NumberStyles.None, CultureInfo.InvariantCulture, out var pageNumber))
            {
                return Results.BadRequest(new { title = "A rendered resume page number is invalid." });
            }

            var page = pages[index];
            renderedPages.Add(new ResumeImportPage(
                pageNumber,
                page.ContentType.ToLowerInvariant(),
                await ReadBoundedAsync(page, 3 * 1024 * 1024, cancellationToken)));
        }

        var result = await workflows.ImportResumeAsync(
            new ResumeImportPayload(
                $"resume.{sourceKind}",
                SourceMediaType(sourceKind),
                [],
                sourceKind,
                form["embeddedTextEvidence"].ToString(),
                renderedPages),
            cancellationToken);
        return Results.Ok(new { result.Proposal, result.DetectedText });
    }

    private static string? NormalizeSourceKind(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Contains("pdf", StringComparison.Ordinal) || normalized.EndsWith(".pdf", StringComparison.Ordinal)) return "pdf";
        if (normalized.Contains("wordprocessingml", StringComparison.Ordinal) || normalized.Contains("docx", StringComparison.Ordinal)) return "docx";
        if (normalized is "text/plain" or "txt" || normalized.EndsWith(".txt", StringComparison.Ordinal)) return "txt";
        return null;
    }

    private static string SourceMediaType(string sourceKind) => sourceKind switch
    {
        "pdf" => "application/pdf",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ => "text/plain",
    };

    private static async Task<IResult> TailorResumeAsync(
        HttpRequest request,
        PrivateAiResumeWorkflows workflows,
        CancellationToken cancellationToken)
    {
        using var document = await JsonDocument.ParseAsync(
            request.Body,
            new JsonDocumentOptions { MaxDepth = 32 },
            cancellationToken);
        var proposal = await workflows.TailorResumeAsync(document.RootElement, cancellationToken);
        return Results.Ok(new { proposal });
    }

    private static async Task<byte[]> ReadBoundedAsync(
        IFormFile file,
        int maximumBytes,
        CancellationToken cancellationToken)
    {
        if (file.Length is < 1 || file.Length > maximumBytes)
        {
            throw new InvalidDataException("A resume import file exceeded the accepted size.");
        }

        await using var source = file.OpenReadStream();
        using var destination = new MemoryStream((int)file.Length);
        await source.CopyToAsync(destination, cancellationToken);
        if (destination.Length > maximumBytes)
        {
            throw new InvalidDataException("A resume import file exceeded the accepted size.");
        }

        return destination.ToArray();
    }
}
