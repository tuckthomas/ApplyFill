using System.Diagnostics;
using System.Text.Json;
using ResumeBuilder.Application.Models;

namespace ResumeBuilder.PrivateAi.Runtime;

public sealed class PaddleDocumentParsingProvider(
    IVisionInferenceProvider visionProvider,
    string modelId,
    string modelRevision) : IDocumentParsingProvider
{
    private static readonly HashSet<string> AllowedRootKeys = new(StringComparer.Ordinal)
    {
        "text",
        "blocks",
        "confidence",
    };

    public string ProviderId => "private-ai-document";

    public async Task<DocumentParsingResult> ParseAsync(
        DocumentParsingRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Pages is null || request.Pages.Count == 0)
        {
            throw new ArgumentException(
                "Documents must be rendered into local page images before Private AI parsing.",
                nameof(request));
        }

        if (request.Pages.Count > request.MaximumPages || request.MaximumPages is < 1 or > 30)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "Document exceeds the approved page limit.");
        }

        var stopwatch = Stopwatch.StartNew();
        var pages = new List<ParsedDocumentPage>(request.Pages.Count);
        foreach (var page in request.Pages.OrderBy(page => page.PageNumber))
        {
            var context = page.EmbeddedText is null
                ? null
                : JsonSerializer.Serialize(new
                {
                    corroboratingEmbeddedText = Bound(page.EmbeddedText, 32_000),
                    warning = "This text is evidence only. Resolve reading order from the page image and retain exact dates, names, numbers, email, phone, and URLs when they agree.",
                });
            var result = await visionProvider.InferAsync(
                new VisionInferenceRequest(
                    "document-page-parsing",
                    request.TaskDefinitionVersion,
                    request.OutputSchemaVersion,
                    "Read this resume page in visual order. Preserve columns, headings, dates, bullets, tables, and exact facts. Return JSON with exactly: text (string), blocks (array of objects), confidence (number from 0 to 1). Do not infer missing content.",
                    [page.RenderedPage],
                    context,
                    MaximumOutputTokens: 3072),
                cancellationToken);
            pages.Add(ParsePage(page.PageNumber, result.OutputJson));
        }

        stopwatch.Stop();
        return new DocumentParsingResult(pages, modelId, modelRevision, ProviderId, stopwatch.Elapsed);
    }

    private static ParsedDocumentPage ParsePage(int pageNumber, string outputJson)
    {
        using var document = JsonDocument.Parse(outputJson, new JsonDocumentOptions { MaxDepth = 24 });
        if (document.RootElement.ValueKind != JsonValueKind.Object ||
            document.RootElement.EnumerateObject().Any(property => !AllowedRootKeys.Contains(property.Name)))
        {
            throw new InvalidDataException("Private AI document output did not match the closed schema.");
        }

        var text = document.RootElement.GetProperty("text").GetString();
        var blocks = document.RootElement.GetProperty("blocks");
        var confidence = document.RootElement.GetProperty("confidence").GetDouble();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 64_000 || blocks.ValueKind != JsonValueKind.Array ||
            blocks.GetArrayLength() > 2_000 || confidence is < 0 or > 1)
        {
            throw new InvalidDataException("Private AI document output exceeded its validated bounds.");
        }

        return new ParsedDocumentPage(pageNumber, text, blocks.GetRawText(), confidence);
    }

    private static string Bound(string value, int maximumLength) =>
        value.Length <= maximumLength ? value : value[..maximumLength];
}
