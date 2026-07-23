using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Api;
using ResumeBuilder.Api.Problems;
using ResumeBuilder.Api.Security;
using ResumeBuilder.Infrastructure;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Forwarder;
using Yarp.ReverseProxy.Transforms;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 16 * 1024 * 1024);
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        var definition = ApplyFillProblemMapper.Map(context.Exception, context.ProblemDetails.Status);
        context.ProblemDetails.Extensions["code"] = definition.WireCode;
        context.ProblemDetails.Type ??= definition.Type;
        context.ProblemDetails.Title ??= definition.Title;
    };
});
builder.Services.AddExceptionHandler<ApplyFillExceptionHandler>();
builder.Services.AddSingleton<IWorkerServiceTokenAuthenticator, WorkerServiceTokenAuthenticator>();
builder.Services.AddHostedService<RetentionWorker>();
builder.Services.AddControllers(options => options.MaxModelBindingCollectionSize = 500);
builder.Services.AddOpenApi("v1");
builder.Services.AddApplyFillInfrastructure(builder.Configuration);
var workerServiceToken = Environment.GetEnvironmentVariable("APPLYFILL_BROWSER_WORKER_TOKEN") ??
    builder.Configuration["ApplyFill:Worker:ServiceToken"] ??
    string.Empty;
var proxyRoutes = new[]
{
    new RouteConfig
    {
        RouteId = "browser-agent-api",
        ClusterId = "local-worker",
        Match = new RouteMatch { Path = "/api/browser-agent/{**catch-all}" },
    },
    new RouteConfig
    {
        RouteId = "private-ai-api",
        ClusterId = "local-worker",
        Match = new RouteMatch { Path = "/api/private-ai/{**catch-all}" },
    },
    new RouteConfig
    {
        RouteId = "browser-agent-hub",
        ClusterId = "local-worker",
        Match = new RouteMatch { Path = "/hubs/browser-agent/{**catch-all}" },
    },
};
var proxyClusters = new[]
{
    new ClusterConfig
    {
        ClusterId = "local-worker",
        HttpRequest = new ForwarderRequestConfig
        {
            // Vision/OCR on supported consumer hardware can legitimately take several minutes.
            // Keep the loopback request alive while cancellation still flows from the browser.
            ActivityTimeout = TimeSpan.FromMinutes(15),
        },
        Destinations = new Dictionary<string, DestinationConfig>(StringComparer.Ordinal)
        {
            ["worker"] = new() { Address = "http://127.0.0.1:5098/" },
        },
    },
};
builder.Services.AddReverseProxy()
    .LoadFromMemory(proxyRoutes, proxyClusters)
    .AddTransforms(transforms => transforms.AddRequestTransform(context =>
    {
        context.ProxyRequest.Headers.Remove("X-ApplyFill-Service-Token");
        context.ProxyRequest.Headers.TryAddWithoutValidation("X-ApplyFill-Service-Token", workerServiceToken);
        return ValueTask.CompletedTask;
    }));

var allowedOrigins = builder.Configuration.GetSection("ApplyFill:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("ApplyFill", policy =>
{
    if (allowedOrigins.Length > 0)
    {
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    }
}));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("commands", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 120,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

var app = builder.Build();

app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers.CacheControl = "no-store";
    await next(context);
});
app.UseMiddleware<LoopbackOnlyMiddleware>();
app.UseCors("ApplyFill");
app.UseRateLimiter();
app.UseMiddleware<LocalCommandGuardMiddleware>();
app.UseMiddleware<ApiIdempotencyMiddleware>();
app.UseWebSockets();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();
app.MapReverseProxy();
app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("ready") });

if (builder.Configuration.GetValue("ApplyFill:Database:ApplyMigrations", false))
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplyFillDbContext>();
    await dbContext.Database.MigrateAsync();
}

await app.RunAsync();

public partial class Program;
