using System.Net;

namespace ResumeBuilder.Api.Security;

public sealed class LoopbackOnlyMiddleware(RequestDelegate next, IWebHostEnvironment environment)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!environment.IsEnvironment("Testing") &&
            context.Connection.RemoteIpAddress is { } address &&
            !IPAddress.IsLoopback(address))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                type = "https://applyfill.local/problems/non-loopback-request",
                title = "ApplyFill only accepts requests from this computer.",
                status = StatusCodes.Status403Forbidden,
                code = "non-loopback-request",
            });
            return;
        }

        await next(context);
    }
}

public sealed class LocalCommandGuardMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Get,
        HttpMethods.Head,
        HttpMethods.Options,
    };

    public async Task InvokeAsync(HttpContext context)
    {
        if (SafeMethods.Contains(context.Request.Method) || !context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        if (!string.Equals(context.Request.Headers["X-ApplyFill-Request"], "1", StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(context.Request.Headers["Idempotency-Key"]))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new
            {
                type = "https://applyfill.local/problems/command-headers-required",
                title = "This command is missing local request protection.",
                status = StatusCodes.Status400BadRequest,
                code = "command-headers-required",
            });
            return;
        }

        await next(context);
    }
}
