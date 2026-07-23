using Microsoft.AspNetCore.Http.Json;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Security;
using ResumeBuilder.BrowserWorker.Streaming;
using ResumeBuilder.PrivateAi;
using ResumeBuilder.PrivateAi.Setup;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://127.0.0.1:5098");
builder.Services.Configure<BrowserRuntimeOptions>(builder.Configuration.GetSection(BrowserRuntimeOptions.SectionName));
builder.Services.Configure<FramePumpOptions>(builder.Configuration.GetSection("ViewportStreaming"));
builder.Services.Configure<PrivateAiOptions>(options =>
{
    builder.Configuration.GetSection(PrivateAiOptions.SectionName).Bind(options);
    var configuredRoot = Environment.GetEnvironmentVariable("APPLYFILL_PRIVATE_AI_ROOT");
    if (!string.IsNullOrWhiteSpace(configuredRoot))
    {
        options.InstallationRoot = configuredRoot;
    }
});
builder.Services.Configure<WorkerSecurityOptions>(options =>
{
    builder.Configuration.GetSection(WorkerSecurityOptions.SectionName).Bind(options);
    options.ServiceToken = Environment.GetEnvironmentVariable("APPLYFILL_BROWSER_WORKER_TOKEN") ?? options.ServiceToken;
});
builder.Services.Configure<ApplyFillApiOptions>(options =>
{
    builder.Configuration.GetSection(ApplyFillApiOptions.SectionName).Bind(options);
    options.WorkerToken = Environment.GetEnvironmentVariable("APPLYFILL_BROWSER_WORKER_TOKEN") ?? options.WorkerToken;
});
builder.Services.Configure<JsonOptions>(options => options.SerializerOptions.MaxDepth = 32);
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Title = "ApplyFill could not complete that local request.";
        context.ProblemDetails.Detail = "Nothing was changed. Try again, or restart ApplyFill if the problem continues.";
        context.ProblemDetails.Extensions.Clear();
    };
});
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = false;
    options.MaximumReceiveMessageSize = 128 * 1024;
    options.StreamBufferCapacity = 2;
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ControlLeaseManager>();
builder.Services.AddSingleton<BrowserActionPolicy>();
builder.Services.AddSingleton<SessionAccessRegistry>();
builder.Services.AddSingleton<LatestFrameStore>();
builder.Services.AddSingleton<IUserAnswerInbox, InMemoryUserAnswerInbox>();
builder.Services.AddSingleton<ApiApprovedArtifactStore>();
builder.Services.AddSingleton<IApprovedArtifactStore>(services => services.GetRequiredService<ApiApprovedArtifactStore>());
builder.Services.AddSingleton<PrivateAiService>();
builder.Services.AddSingleton<IPrivateAiInference>(services => services.GetRequiredService<PrivateAiService>());
builder.Services.AddSingleton<IApplicationPlanner, PrivateAiApplicationPlanner>();
builder.Services.AddSingleton<PrivateAiResumeWorkflows>();
builder.Services.AddSingleton(services =>
    ApiRelevantAnswerSource.CreateHttpClient(services.GetRequiredService<Microsoft.Extensions.Options.IOptions<ApplyFillApiOptions>>().Value));
builder.Services.AddSingleton<ApiRunCheckpointStore>();
builder.Services.AddSingleton<IRunCheckpointStore>(services => services.GetRequiredService<ApiRunCheckpointStore>());
builder.Services.AddSingleton<IWorkerRunStore>(services => services.GetRequiredService<ApiRunCheckpointStore>());
builder.Services.AddSingleton<ApiRelevantAnswerSource>();
builder.Services.AddSingleton<IRelevantAnswerSource>(services => services.GetRequiredService<ApiRelevantAnswerSource>());
builder.Services.AddSingleton<ISensitiveAnswerApprovalCoordinator>(services => services.GetRequiredService<ApiRelevantAnswerSource>());
builder.Services.AddSingleton<IDeterministicActionResolver, DeterministicActionResolver>();
builder.Services.AddSingleton<IManagedBrowserRuntime, PlaywrightBrowserRuntime>();
builder.Services.AddSingleton<ViewportStreamCoordinator>();
builder.Services.AddSingleton<BrowserRunControl>();
builder.Services.AddSingleton<ApplicationRunOrchestrator>();
builder.Services.AddSingleton<BrowserAgentRunService>();

var app = builder.Build();
app.UseExceptionHandler();
app.UseMiddleware<LocalWorkerBoundaryMiddleware>();

await app.Services.GetRequiredService<PrivateAiService>().InitializeAsync(app.Lifetime.ApplicationStopping);

app.MapGet("/health", () => Results.Ok(new { status = "ready" }));

app.MapGet("/api/private-ai/status", (PrivateAiService privateAi) => Results.Ok(ToPrivateAiResponse(privateAi.Status)));

app.MapPost("/api/private-ai/setup", (
    PrivateAiService privateAi,
    IHostApplicationLifetime lifetime,
    ILogger<PrivateAiService> logger) =>
{
    privateAi.BeginSetup();
    _ = RunPrivateAiSetupAsync(privateAi, lifetime.ApplicationStopping, logger);
    return Results.Accepted("/api/private-ai/status", ToPrivateAiResponse(privateAi.Status));
});

app.MapPost("/api/private-ai/setup/cancel", (PrivateAiService privateAi) =>
{
    privateAi.CancelSetup();
    return Results.Accepted("/api/private-ai/status", ToPrivateAiResponse(privateAi.Status));
});

app.MapDelete("/api/private-ai", async (PrivateAiService privateAi, CancellationToken cancellationToken) =>
{
    await privateAi.RemoveAsync(cancellationToken);
    return Results.NoContent();
});
app.MapPrivateAiWorkflowEndpoints();

app.MapPost("/internal/browser-sessions", async (
    StartBrowserSessionRequest request,
    IManagedBrowserRuntime browser,
    SessionAccessRegistry access,
    ControlLeaseManager leases,
    CancellationToken cancellationToken) =>
{
    var descriptor = await browser.StartAsync(request.RunId, request.Session, cancellationToken);
    var credential = access.Register(descriptor.SessionId, request.Session.OwnerId);
    var lease = leases.Get(descriptor.SessionId);
    return Results.Created($"/internal/browser-sessions/{descriptor.SessionId}",
        new StartBrowserSessionResponse(descriptor with { ControlOwner = lease.Owner }, credential.AccessToken, lease));
});

app.MapGet("/internal/browser-sessions/{sessionId:guid}", async (
    Guid sessionId,
    string ownerId,
    HttpRequest request,
    IManagedBrowserRuntime browser,
    SessionAccessRegistry access,
    ControlLeaseManager leases,
    CancellationToken cancellationToken) =>
{
    if (!ValidateSessionAccess(request, access, sessionId, ownerId)) return Results.NotFound();
    var descriptor = await browser.GetAsync(sessionId, ownerId, cancellationToken);
    return descriptor is null ? Results.NotFound() : Results.Ok(descriptor with { ControlOwner = leases.Get(sessionId).Owner });
});

app.MapPost("/internal/browser-sessions/{sessionId:guid}/observe", async (
    Guid sessionId,
    string ownerId,
    HttpRequest request,
    IManagedBrowserRuntime browser,
    SessionAccessRegistry access,
    CancellationToken cancellationToken) =>
{
    if (!ValidateSessionAccess(request, access, sessionId, ownerId)) return Results.NotFound();
    return Results.Ok(await browser.ObserveAsync(sessionId, ownerId, cancellationToken));
});

app.MapDelete("/internal/browser-sessions/{sessionId:guid}", async (
    Guid sessionId,
    string ownerId,
    HttpRequest request,
    IManagedBrowserRuntime browser,
    SessionAccessRegistry access,
    CancellationToken cancellationToken) =>
{
    if (!ValidateSessionAccess(request, access, sessionId, ownerId)) return Results.NotFound();
    await browser.StopAsync(sessionId, ownerId, cancellationToken);
    access.Revoke(sessionId);
    return Results.NoContent();
});

app.MapGet("/api/browser-agent/runs", (BrowserAgentRunService runs, CancellationToken cancellationToken) =>
    runs.ListAsync(cancellationToken));

app.MapPost("/api/browser-agent/runs", (StartBrowserRunRequest request, BrowserAgentRunService runs, CancellationToken cancellationToken) =>
    runs.StartAsync(request, cancellationToken));

app.MapGet("/api/browser-agent/runs/{runId:guid}", (Guid runId, BrowserAgentRunService runs, CancellationToken cancellationToken) =>
    runs.GetAsync(runId, cancellationToken));

app.MapPost("/api/browser-agent/runs/{runId:guid}/recover", (Guid runId, BrowserAgentRunService runs, CancellationToken cancellationToken) =>
    runs.RecoverAsync(runId, cancellationToken));

app.MapPost("/api/browser-agent/runs/{runId:guid}/commands", (
    Guid runId,
    BrowserRunCommandRequest request,
    BrowserAgentRunService runs,
    CancellationToken cancellationToken) => runs.CommandAsync(runId, request, cancellationToken));

app.MapPost("/api/browser-agent/runs/{runId:guid}/questions/{questionId}/answer", (
    Guid runId,
    string questionId,
    BrowserQuestionAnswerRequest request,
    BrowserAgentRunService runs,
    CancellationToken cancellationToken) => runs.AnswerQuestionAsync(runId, questionId, request, cancellationToken));

app.MapPost("/api/browser-agent/runs/{runId:guid}/input", async (
    Guid runId,
    BrowserInputRequest request,
    BrowserAgentRunService runs,
    CancellationToken cancellationToken) =>
{
    await runs.SendInputAsync(runId, request, cancellationToken);
    return Results.NoContent();
});

app.MapGet("/api/browser-agent/runs/{runId:guid}/frame/latest", (Guid runId, long? sequence, BrowserAgentRunService runs) =>
{
    var frame = sequence is { } frameSequence
        ? runs.GetFrame(runId, frameSequence)
        : runs.GetLatestFrame(runId);
    return frame is null ? Results.NotFound() : Results.File(frame.JpegBytes, "image/jpeg", enableRangeProcessing: false);
});

app.MapDelete("/api/browser-agent/runs/{runId:guid}", async (
    Guid runId,
    BrowserAgentRunService runs,
    CancellationToken cancellationToken) =>
{
    await runs.DeleteAsync(runId, cancellationToken);
    return Results.NoContent();
});

app.MapHub<BrowserAgentHub>("/internal/browser-agent-hub");
app.MapHub<BrowserAgentHub>("/hubs/browser-agent");
app.Run();

static bool ValidateSessionAccess(HttpRequest request, SessionAccessRegistry access, Guid sessionId, string ownerId) =>
    access.Validate(sessionId, ownerId, request.Headers["X-ApplyFill-Session-Token"].ToString());

static object ToPrivateAiResponse(PrivateAiServiceSnapshot status)
{
    var state = status.State switch
    {
        PrivateAiSetupState.NotConfigured => "not-ready",
        PrivateAiSetupState.CheckingComputer => "checking",
        PrivateAiSetupState.Downloading => "downloading",
        PrivateAiSetupState.Verifying or PrivateAiSetupState.Preparing => "installing",
        PrivateAiSetupState.Ready => "ready",
        PrivateAiSetupState.NeedsAttention or PrivateAiSetupState.Unavailable => "failed",
        _ => "failed",
    };
    var progress = status.TotalBytes <= 0
        ? 0
        : (int)Math.Clamp(status.CompletedBytes * 100 / status.TotalBytes, 0, 100);
    var downloadSize = status.TotalBytes <= 0
        ? null
        : $"{status.TotalBytes / (1024d * 1024 * 1024):0.0} GB";
    return new
    {
        state,
        progress,
        stage = status.State switch
        {
            PrivateAiSetupState.CheckingComputer => "Checking this computer",
            PrivateAiSetupState.Downloading => "Downloading Private AI",
            PrivateAiSetupState.Verifying => "Verifying Private AI",
            PrivateAiSetupState.Preparing => "Preparing Private AI",
            _ => null,
        },
        downloadSize,
        message = status.Message ?? status.State switch
        {
            PrivateAiSetupState.Downloading => "Downloading Private AI. Keep ApplyFill open.",
            PrivateAiSetupState.Verifying => "Checking the Private AI download.",
            PrivateAiSetupState.Preparing => "Finishing Private AI setup.",
            PrivateAiSetupState.Ready => "Private AI is ready.",
            _ => "Private AI is not set up.",
        },
        canRetry = status.State is PrivateAiSetupState.NeedsAttention or PrivateAiSetupState.Unavailable,
        updateAvailable = false,
        diagnosticsId = status.DiagnosticsId,
    };
}

static async Task RunPrivateAiSetupAsync(
    PrivateAiService privateAi,
    CancellationToken cancellationToken,
    ILogger logger)
{
    try
    {
        await privateAi.SetupAsync(cancellationToken);
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
        Program.LogPrivateAiSetupStopped(logger);
    }
    catch (Exception exception)
    {
        Program.LogPrivateAiSetupFailure(logger, exception.GetType().Name);
    }
}

public partial class Program
{
    [Microsoft.Extensions.Logging.LoggerMessage(
        EventId = 201,
        Level = LogLevel.Information,
        Message = "Private AI setup stopped because ApplyFill is shutting down.")]
    internal static partial void LogPrivateAiSetupStopped(ILogger logger);

    [Microsoft.Extensions.Logging.LoggerMessage(
        EventId = 202,
        Level = LogLevel.Warning,
        Message = "Private AI setup needs attention: {FailureType}")]
    internal static partial void LogPrivateAiSetupFailure(ILogger logger, string failureType);
}
