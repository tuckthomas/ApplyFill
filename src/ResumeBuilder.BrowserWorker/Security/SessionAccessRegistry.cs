using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace ResumeBuilder.BrowserWorker.Security;

public sealed record BrowserSessionAccess(Guid SessionId, string OwnerId, string AccessToken);

public sealed class SessionAccessRegistry
{
    private sealed record Entry(string OwnerId, byte[] TokenHash);

    private readonly ConcurrentDictionary<Guid, Entry> _entries = new();

    public BrowserSessionAccess Register(Guid sessionId, string ownerId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerId);
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        if (!_entries.TryAdd(sessionId, new Entry(ownerId, hash)))
            throw new InvalidOperationException("Browser-session access is already registered.");
        return new BrowserSessionAccess(sessionId, ownerId, token);
    }

    public bool Validate(Guid sessionId, string ownerId, string accessToken)
    {
        if (!_entries.TryGetValue(sessionId, out var entry) || entry.OwnerId != ownerId || string.IsNullOrEmpty(accessToken))
            return false;
        var supplied = SHA256.HashData(Encoding.UTF8.GetBytes(accessToken));
        return CryptographicOperations.FixedTimeEquals(entry.TokenHash, supplied);
    }

    public void Revoke(Guid sessionId) => _entries.TryRemove(sessionId, out _);
}

public sealed class WorkerSecurityOptions
{
    public const string SectionName = "WorkerSecurity";
    public string ServiceToken { get; set; } = string.Empty;
    public IReadOnlySet<string> AllowedOrigins { get; set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "http://127.0.0.1:5173",
        "http://localhost:5173"
    };
}

public sealed class LocalWorkerBoundaryMiddleware
{
    private readonly RequestDelegate _next;
    private readonly byte[] _expectedTokenHash;
    private readonly IReadOnlySet<string> _allowedOrigins;

    public LocalWorkerBoundaryMiddleware(RequestDelegate next, Microsoft.Extensions.Options.IOptions<WorkerSecurityOptions> options)
    {
        _next = next;
        if (options.Value.ServiceToken.Length < 32)
            throw new InvalidOperationException("WorkerSecurity:ServiceToken must be an ephemeral secret of at least 32 characters.");
        _expectedTokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(options.Value.ServiceToken));
        _allowedOrigins = options.Value.AllowedOrigins;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var remoteAddress = context.Connection.RemoteIpAddress;
        if (remoteAddress is null || !System.Net.IPAddress.IsLoopback(remoteAddress))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        if (context.Request.Path == "/health")
        {
            await _next(context);
            return;
        }

        if (context.Request.Headers.Origin is { Count: > 0 } origins &&
            origins.Any(origin => !_allowedOrigins.Contains(origin!)))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var token = context.Request.Headers["X-ApplyFill-Service-Token"].ToString();
        var suppliedHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        if (!CryptographicOperations.FixedTimeEquals(_expectedTokenHash, suppliedHash))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        await _next(context);
    }
}
