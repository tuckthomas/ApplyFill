using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public static class PrivateAiWorkflowEndpoints
{
    private const long MaximumRequestBytes = 36L * 1024 * 1024;
    private static readonly JsonSerializerOptions StreamJsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapPrivateAiWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/private-ai/resume-import", ImportResumeAsync)
            .WithMetadata(new RequestSizeLimitAttribute(MaximumRequestBytes));
        endpoints.MapPost("/api/private-ai/resume-tailoring", TailorResumeAsync)
            .WithMetadata(new RequestSizeLimitAttribute(512 * 1024));
        return endpoints;
    }

    private static async Task ImportResumeAsync(
        HttpContext context,
        PrivateAiResumeWorkflows workflows,
        CancellationToken cancellationToken)
    {
        var request = context.Request;
        var response = context.Response;
        if (!request.HasFormContentType)
        {
            response.StatusCode = StatusCodes.Status400BadRequest;
            await response.WriteAsJsonAsync(new { title = "Choose a resume file to import." }, cancellationToken);
            return;
        }

        var form = await request.ReadFormAsync(cancellationToken);
        var pages = form.Files.GetFiles("pages");
        var pageNumbers = form["pageNumbers"];
        var sourceKind = NormalizeSourceKind(form["sourceKind"].ToString());
        if (pages.Count == 0 || pageNumbers.Count != pages.Count || sourceKind is null)
        {
            response.StatusCode = StatusCodes.Status400BadRequest;
            await response.WriteAsJsonAsync(new { title = "ApplyFill could not read the rendered resume pages." }, cancellationToken);
            return;
        }

        var renderedPages = new List<ResumeImportPage>(pages.Count);
        for (var index = 0; index < pages.Count; index++)
        {
            if (!int.TryParse(pageNumbers[index], NumberStyles.None, CultureInfo.InvariantCulture, out var pageNumber))
            {
                response.StatusCode = StatusCodes.Status400BadRequest;
                await response.WriteAsJsonAsync(new { title = "A rendered resume page number is invalid." }, cancellationToken);
                return;
            }

            var page = pages[index];
            renderedPages.Add(new ResumeImportPage(
                pageNumber,
                page.ContentType.ToLowerInvariant(),
                await ReadBoundedAsync(page, 3 * 1024 * 1024, cancellationToken)));
        }

        response.ContentType = "application/x-ndjson; charset=utf-8";
        response.Headers.CacheControl = "no-store";
        response.Headers["X-Accel-Buffering"] = "no";
        context.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();
        await response.StartAsync(cancellationToken);

        var progressChannel = Channel.CreateUnbounded<ResumeImportProgress>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });
        var progress = new CallbackProgress<ResumeImportProgress>(
            update => progressChannel.Writer.TryWrite(update));
        var stopwatch = Stopwatch.StartNew();
        ResumeImportProgress? latest = null;
        var nextHeartbeat = TimeSpan.Zero;
        var workflowTask = workflows.ImportResumeAsync(
            new ResumeImportPayload(
                $"resume.{sourceKind}",
                SourceMediaType(sourceKind),
                [],
                sourceKind,
                form["embeddedTextEvidence"].ToString(),
                renderedPages),
            cancellationToken,
            progress);

        try
        {
            while (!workflowTask.IsCompleted)
            {
                while (progressChannel.Reader.TryRead(out var update))
                {
                    latest = update;
                    await WriteStreamEventAsync(response, new
                    {
                        type = "progress",
                        update.Stage,
                        update.Progress,
                        update.Message,
                        elapsedSeconds = (int)stopwatch.Elapsed.TotalSeconds,
                    }, cancellationToken);
                    nextHeartbeat = stopwatch.Elapsed.Add(TimeSpan.FromSeconds(5));
                }

                if (latest is not null && stopwatch.Elapsed >= nextHeartbeat)
                {
                    await WriteStreamEventAsync(response, new
                    {
                        type = "progress",
                        latest.Stage,
                        latest.Progress,
                        latest.Message,
                        elapsedSeconds = (int)stopwatch.Elapsed.TotalSeconds,
                    }, cancellationToken);
                    nextHeartbeat = stopwatch.Elapsed.Add(TimeSpan.FromSeconds(5));
                }

                await Task.WhenAny(workflowTask, Task.Delay(250, cancellationToken));
            }

            while (progressChannel.Reader.TryRead(out var update))
            {
                latest = update;
                await WriteStreamEventAsync(response, new
                {
                    type = "progress",
                    update.Stage,
                    update.Progress,
                    update.Message,
                    elapsedSeconds = (int)stopwatch.Elapsed.TotalSeconds,
                }, cancellationToken);
            }

            var result = await workflowTask;
            await WriteStreamEventAsync(response, new
            {
                type = "result",
                result.Proposal,
                result.DetectedText,
            }, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The browser stopped listening. Workflow cancellation prevents mutation.
        }
        catch (Exception exception) when (exception is InvalidDataException or JsonException or HttpRequestException or InvalidOperationException)
        {
            await WriteStreamEventAsync(response, new
            {
                type = "error",
                message = "Private AI could not finish reading this resume. Nothing was changed.",
            }, cancellationToken);
        }
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

    private static async Task WriteStreamEventAsync(
        HttpResponse response,
        object value,
        CancellationToken cancellationToken)
    {
        await JsonSerializer.SerializeAsync(response.Body, value, value.GetType(), StreamJsonOptions, cancellationToken);
        await response.WriteAsync("\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    private sealed class CallbackProgress<T>(Action<T> callback) : IProgress<T>
    {
        public void Report(T value) => callback(value);
    }
}
