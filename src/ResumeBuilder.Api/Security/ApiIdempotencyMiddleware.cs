using System.Security.Cryptography;
using System.Text;
using ResumeBuilder.Application.Common;

namespace ResumeBuilder.Api.Security;

public sealed class ApiIdempotencyMiddleware(RequestDelegate next)
{
    private const int MaximumRequestBytes = 20 * 1024 * 1024;
    private const int MaximumResponseBytes = 1024 * 1024;

    public async Task InvokeAsync(
        HttpContext context,
        ICurrentInstallation installation,
        IApiIdempotencyStore store)
    {
        if (IsSafe(context.Request.Method) ||
            !context.Request.Path.StartsWithSegments("/api") ||
            context.Request.Path.Equals("/api/v1/profiles/current/reveal-sensitive", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        var key = context.Request.Headers["Idempotency-Key"].ToString();
        var path = context.Request.Path + context.Request.QueryString;
        string requestHash;
        try
        {
            requestHash = await HashRequestAsync(context.Request, path, context.RequestAborted);
        }
        catch (IOException)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status413PayloadTooLarge,
                "idempotency-request-too-large",
                "This command is too large to process safely.");
            return;
        }

        var acquisition = await store.AcquireAsync(
            installation.Id,
            key,
            context.Request.Method,
            path,
            requestHash,
            context.RequestAborted);
        switch (acquisition.State)
        {
            case IdempotencyAcquireState.Replay:
                await ReplayAsync(context, acquisition.Replay!);
                return;
            case IdempotencyAcquireState.Conflict:
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status409Conflict,
                    "idempotency-key-conflict",
                    "That command key was already used for a different request.");
                return;
            case IdempotencyAcquireState.InProgress:
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status409Conflict,
                    "idempotency-command-in-progress",
                    "The same command is still being processed. Try again shortly.");
                return;
        }

        var originalBody = context.Response.Body;
        await using var responseBuffer = new MemoryStream();
        context.Response.Body = responseBuffer;
        var downstreamCompleted = false;
        try
        {
            await next(context);
            downstreamCompleted = true;
            var responseBody = responseBuffer.ToArray();
            if (context.Response.StatusCode < 500 && responseBody.Length <= MaximumResponseBytes)
            {
                using var completionTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await store.CompleteAsync(
                    installation.Id,
                    key,
                    requestHash,
                    new IdempotencyReplay(
                        context.Response.StatusCode,
                        context.Response.ContentType,
                        responseBody,
                        context.Response.Headers.ETag,
                        context.Response.Headers.Location),
                    completionTimeout.Token);
            }

            responseBuffer.Position = 0;
            context.Response.Body = originalBody;
            await responseBuffer.CopyToAsync(originalBody, context.RequestAborted);
        }
        catch
        {
            context.Response.Body = originalBody;
            if (!downstreamCompleted)
            {
                await store.AbandonAsync(installation.Id, key, requestHash, CancellationToken.None);
            }

            throw;
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    private static async Task<string> HashRequestAsync(
        HttpRequest request,
        string path,
        CancellationToken cancellationToken)
    {
        request.EnableBuffering(64 * 1024, MaximumRequestBytes);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData(Encoding.UTF8.GetBytes($"{request.Method}\n{path}\n"));
        var buffer = new byte[64 * 1024];
        int read;
        while ((read = await request.Body.ReadAsync(buffer, cancellationToken)) > 0)
        {
            hash.AppendData(buffer, 0, read);
        }

        request.Body.Position = 0;
        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    private static Task ReplayAsync(HttpContext context, IdempotencyReplay replay)
    {
        context.Response.StatusCode = replay.StatusCode;
        context.Response.ContentType = replay.ContentType;
        if (!string.IsNullOrWhiteSpace(replay.ETag))
        {
            context.Response.Headers.ETag = replay.ETag;
        }

        if (!string.IsNullOrWhiteSpace(replay.Location))
        {
            context.Response.Headers.Location = replay.Location;
        }

        return context.Response.Body.WriteAsync(replay.Body, context.RequestAborted).AsTask();
    }

    private static Task WriteProblemAsync(HttpContext context, int status, string code, string title)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new
        {
            type = $"https://applyfill.local/problems/{code}",
            title,
            status,
            code,
        });
    }

    private static bool IsSafe(string method) =>
        HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
}
