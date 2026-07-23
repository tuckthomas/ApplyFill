using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;
using DomainControlOwner = ResumeBuilder.Domain.ApplicationRuns.ControlOwner;
using DomainRunStatus = ResumeBuilder.Domain.ApplicationRuns.ApplicationRunStatus;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public sealed record WorkerRunStart(
    Guid RunId,
    Guid ProfileId,
    Guid? ResumeId,
    Guid? JobApplicationId,
    Uri TargetUri);

public sealed record PersistedWorkerRun(
    Guid RunId,
    Guid JobApplicationId,
    Guid ProfileId,
    Guid? ResumeId,
    string TargetUrl,
    DomainRunStatus Status,
    string Stage,
    DomainControlOwner ControlOwner,
    int RetryCount,
    long LastCheckpointSequence,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? CurrentUrl = null,
    string? BrowserSessionReference = null);

public interface IWorkerRunStore
{
    Task<PersistedWorkerRun> StartOrGetAsync(WorkerRunStart request, CancellationToken cancellationToken);
    Task<PersistedWorkerRun?> FindAsync(Guid runId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PersistedWorkerRun>> ListRecoverableAsync(int take, CancellationToken cancellationToken);
    void AttachBrowserSession(Guid runId, Guid sessionId);
}

/// <summary>
/// Persists only bounded run state and structured action summaries. Page content,
/// screenshots, prompts, form values, and model output never enter this store.
/// </summary>
public sealed class ApiRunCheckpointStore(
    HttpClient httpClient,
    IOptions<ApplyFillApiOptions> options) : IRunCheckpointStore, IWorkerRunStore
{
    private const int MaximumLocalActivity = 100;
    private readonly ApplyFillApiOptions _options = ApiRelevantAnswerSource.ValidateOptions(options.Value);
    private readonly ConcurrentDictionary<Guid, RunProjection> _runs = new();

    public async Task<PersistedWorkerRun> StartOrGetAsync(
        WorkerRunStart request,
        CancellationToken cancellationToken)
    {
        var payload = new StartRunPayload(
            request.RunId,
            request.ProfileId,
            request.ResumeId,
            request.JobApplicationId,
            request.TargetUri.AbsoluteUri,
            DomainRunStatus.Created,
            "Not started",
            DomainControlOwner.None,
            BrowserSessionReference: null);
        using var message = CreateUnsafe(
            HttpMethod.Post,
            "api/internal/v1/application-runs",
            $"run-start:{request.RunId:N}",
            payload);
        var persisted = await SendAsync<PersistedWorkerRun>(message, cancellationToken);
        _runs.AddOrUpdate(
            request.RunId,
            _ => new RunProjection(persisted),
            (_, existing) => existing.Refresh(persisted));
        return persisted;
    }

    public async Task<IReadOnlyList<PersistedWorkerRun>> ListRecoverableAsync(
        int take,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(take, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(take, 100);
        using var message = new HttpRequestMessage(
            HttpMethod.Get,
            $"api/internal/v1/application-runs/recoverable?take={take}");
        AddWorkerHeader(message);
        var persisted = await SendAsync<PersistedWorkerRun[]>(message, cancellationToken);
        foreach (var run in persisted)
        {
            _runs.AddOrUpdate(run.RunId, _ => new RunProjection(run), (_, existing) => existing.Refresh(run));
        }

        return persisted;
    }

    public async Task<PersistedWorkerRun?> FindAsync(Guid runId, CancellationToken cancellationToken)
    {
        using var message = new HttpRequestMessage(
            HttpMethod.Get,
            $"api/internal/v1/application-runs/{runId:D}");
        AddWorkerHeader(message);
        using var response = await httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        var persisted = await response.Content.ReadFromJsonAsync<PersistedWorkerRun>(cancellationToken)
            ?? throw new InvalidOperationException("The local ApplyFill service returned an empty response.");
        _runs.AddOrUpdate(runId, _ => new RunProjection(persisted), (_, existing) => existing.Refresh(persisted));
        return persisted;
    }

    public void AttachBrowserSession(Guid runId, Guid sessionId)
    {
        if (_runs.TryGetValue(runId, out var run))
        {
            lock (run.Gate)
            {
                run.BrowserSessionReference = sessionId.ToString("N");
            }
        }
    }

    public async Task AppendAsync(Checkpoint checkpoint, CancellationToken cancellationToken)
    {
        if (!_runs.TryGetValue(checkpoint.RunId, out var run))
        {
            throw new InvalidOperationException("The durable browser run has not been registered.");
        }

        await run.PersistenceGate.WaitAsync(cancellationToken);
        try
        {
            Guid expectedToken;
            string? browserSessionReference;
            var persistedCheckpoint = checkpoint;
            lock (run.Gate)
            {
                var expectedSequence = run.LastSequence + 1;
                if (checkpoint.Sequence > expectedSequence)
                {
                    throw new InvalidOperationException($"Checkpoint sequence must be {expectedSequence}.");
                }

                if (checkpoint.Sequence < expectedSequence)
                {
                    persistedCheckpoint = checkpoint with { Sequence = expectedSequence };
                }

                expectedToken = run.ConcurrencyToken;
                browserSessionReference = run.BrowserSessionReference;
            }

            // Keep the summary deliberately closed and value-free. In particular, do not
            // add Checkpoint.Target here because it can be derived from page-authored text.
            var summary = JsonSerializer.SerializeToElement(new
            {
                schemaVersion = 1,
                eventType = SafeEventType(persistedCheckpoint.Intent),
                outcome = SafeOutcome(persistedCheckpoint.Result),
                pageGeneration = persistedCheckpoint.PageGeneration,
                submissionApproved = persistedCheckpoint.SubmissionApproved,
                submissionAttempted = persistedCheckpoint.SubmissionAttempted,
            });
            var currentUri = RedactUri(persistedCheckpoint.CurrentUri);
            var payload = new CheckpointPayload(
                expectedToken,
                persistedCheckpoint.Sequence,
                MapStatus(persistedCheckpoint.State),
                SafeStage(persistedCheckpoint.State),
                MapOwner(persistedCheckpoint.Actor),
                RetryCount: 0,
                browserSessionReference,
                currentUri,
                persistedCheckpoint.CurrentUri?.Host,
                summary);
            using var message = CreateUnsafe(
                HttpMethod.Post,
                $"api/internal/v1/application-runs/{persistedCheckpoint.RunId:D}/checkpoints",
                $"run-checkpoint:{persistedCheckpoint.RunId:N}:{persistedCheckpoint.Sequence}",
                payload);
            var persisted = await SendAsync<PersistedWorkerRun>(message, cancellationToken);

            lock (run.Gate)
            {
                run.ConcurrencyToken = persisted.ConcurrencyToken;
                run.LastSequence = persistedCheckpoint.Sequence;
                run.Persisted = persisted;
                run.Activity.Add(persistedCheckpoint);
                if (run.Activity.Count > MaximumLocalActivity)
                {
                    run.Activity.RemoveRange(0, run.Activity.Count - MaximumLocalActivity);
                }
            }
        }
        finally
        {
            run.PersistenceGate.Release();
        }
    }

    public Task<Checkpoint?> GetLatestAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_runs.TryGetValue(runId, out var run))
        {
            return Task.FromResult<Checkpoint?>(null);
        }

        lock (run.Gate)
        {
            if (run.Activity.Count > 0)
            {
                return Task.FromResult<Checkpoint?>(run.Activity[^1]);
            }

            if (run.LastSequence <= 0)
            {
                return Task.FromResult<Checkpoint?>(null);
            }

            var target = Uri.TryCreate(run.Persisted.TargetUrl, UriKind.Absolute, out var uri) ? uri : null;
            return Task.FromResult<Checkpoint?>(new Checkpoint(
                Guid.Empty,
                runId,
                run.LastSequence,
                MapStatus(run.Persisted.Status),
                run.Persisted.Stage,
                target,
                PageGeneration: 0,
                Intent: "Recovered checkpoint",
                Target: string.Empty,
                Result: "recovered",
                MapOwner(run.Persisted.ControlOwner),
                run.Persisted.UpdatedAt,
                SubmissionApproved: false,
                SubmissionAttempted: false));
        }
    }

    public Task<IReadOnlyList<Checkpoint>> GetActivityAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_runs.TryGetValue(runId, out var run))
        {
            return Task.FromResult<IReadOnlyList<Checkpoint>>([]);
        }

        lock (run.Gate)
        {
            return Task.FromResult<IReadOnlyList<Checkpoint>>(run.Activity.ToArray());
        }
    }

    public Task DeleteAsync(Guid runId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _runs.TryRemove(runId, out _);
        // Durable history is retained by backend policy; stopping the run is persisted
        // before this local projection is removed.
        return Task.CompletedTask;
    }

    private HttpRequestMessage CreateUnsafe<T>(HttpMethod method, string path, string operationKey, T payload)
    {
        var message = new HttpRequestMessage(method, path) { Content = JsonContent.Create(payload) };
        AddWorkerHeader(message);
        message.Headers.Add("X-ApplyFill-Request", "1");
        message.Headers.Add("Idempotency-Key", operationKey);
        return message;
    }

    private void AddWorkerHeader(HttpRequestMessage message) =>
        message.Headers.Add("X-ApplyFill-Worker-Token", _options.WorkerToken);

    private async Task<T> SendAsync<T>(HttpRequestMessage message, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(cancellationToken)
            ?? throw new InvalidOperationException("The local ApplyFill service returned an empty response.");
    }

    private static DomainRunStatus MapStatus(RunState state) => state switch
    {
        RunState.Created => DomainRunStatus.Created,
        RunState.StartingBrowser => DomainRunStatus.StartingBrowser,
        RunState.Navigating => DomainRunStatus.Navigating,
        RunState.Observing => DomainRunStatus.Observing,
        RunState.Planning => DomainRunStatus.Planning,
        RunState.AgentRunning => DomainRunStatus.AgentRunning,
        RunState.Pausing => DomainRunStatus.Pausing,
        RunState.Paused => DomainRunStatus.Paused,
        RunState.UserControl => DomainRunStatus.UserControl,
        RunState.AwaitingUser => DomainRunStatus.AwaitingUser,
        RunState.Recovering => DomainRunStatus.Recovering,
        RunState.ReviewReady => DomainRunStatus.ReviewReady,
        RunState.Submitting => DomainRunStatus.Submitting,
        RunState.Completed => DomainRunStatus.Completed,
        RunState.Stopped => DomainRunStatus.Stopped,
        RunState.Failed => DomainRunStatus.Failed,
        _ => throw new ArgumentOutOfRangeException(nameof(state)),
    };

    private static RunState MapStatus(DomainRunStatus state) => state switch
    {
        DomainRunStatus.Created => RunState.Created,
        DomainRunStatus.StartingBrowser => RunState.StartingBrowser,
        DomainRunStatus.Navigating => RunState.Navigating,
        DomainRunStatus.Observing => RunState.Observing,
        DomainRunStatus.Planning => RunState.Planning,
        DomainRunStatus.AgentRunning => RunState.AgentRunning,
        DomainRunStatus.Pausing => RunState.Pausing,
        DomainRunStatus.Paused => RunState.Paused,
        DomainRunStatus.UserControl => RunState.UserControl,
        DomainRunStatus.AwaitingUser => RunState.AwaitingUser,
        DomainRunStatus.Recovering => RunState.Recovering,
        DomainRunStatus.ReviewReady => RunState.ReviewReady,
        DomainRunStatus.Submitting => RunState.Submitting,
        DomainRunStatus.Completed => RunState.Completed,
        DomainRunStatus.Stopped => RunState.Stopped,
        DomainRunStatus.Failed => RunState.Failed,
        _ => throw new ArgumentOutOfRangeException(nameof(state)),
    };

    private static DomainControlOwner MapOwner(ControlOwner owner) => owner switch
    {
        ControlOwner.Agent => DomainControlOwner.Agent,
        ControlOwner.User => DomainControlOwner.User,
        ControlOwner.None => DomainControlOwner.None,
        _ => throw new ArgumentOutOfRangeException(nameof(owner)),
    };

    private static ControlOwner MapOwner(DomainControlOwner owner) => owner switch
    {
        DomainControlOwner.Agent => ControlOwner.Agent,
        DomainControlOwner.User => ControlOwner.User,
        DomainControlOwner.None => ControlOwner.None,
        _ => throw new ArgumentOutOfRangeException(nameof(owner)),
    };

    private static string SafeStage(RunState state) => state switch
    {
        RunState.Created => "Created",
        RunState.StartingBrowser => "Starting browser",
        RunState.Navigating => "Navigating",
        RunState.Observing => "Reading application step",
        RunState.Planning => "Planning application step",
        RunState.AgentRunning => "Completing application step",
        RunState.Pausing or RunState.Paused => "Paused",
        RunState.UserControl => "User control",
        RunState.AwaitingUser => "Waiting for user",
        RunState.Recovering => "Recovering",
        RunState.ReviewReady => "Final review",
        RunState.Submitting => "Submitting",
        RunState.Completed => "Completed",
        RunState.Stopped => "Stopped",
        RunState.Failed => "Needs attention",
        _ => "Browser step",
    };

    private static string SafeEventType(string intent) => intent switch
    {
        "Open application" => "run-started",
        "Request user input" or "Ask user" or "Request sensitive approval" => "user-input-requested",
        "Confirm completion" => "completion-observed",
        "Final review" => "review-ready",
        "Safety limit" => "safety-limit",
        "Policy denied action" => "policy-denied",
        "Submit application" => "submission-attempted",
        "User command" => "user-command",
        "Type" or "Select" or "Check" or "Click" or "Focus" or "Scroll" or "Wait" => "browser-action",
        _ => "browser-step",
    };

    private static string SafeOutcome(string result) => result switch
    {
        "verified" => "verified",
        "navigation-started" => "navigation-started",
        "sensitive-approval-required" => "approval-required",
        "user-input-required" => "user-input-required",
        "review-ready" => "review-ready",
        "completed" => "completed",
        "submitted" => "submitted",
        "submission-started" => "submission-started",
        "submission-not-verified" => "submission-not-verified",
        "run-failed" or "browser-error" => "failed",
        "stopped" or "stop" => "stopped",
        "pause" => "paused",
        "resume" or "return-control" => "resumed",
        "take-control" => "user-control",
        "answer-received" => "answer-received",
        "sensitive-answer-declined" => "answer-declined",
        _ => "recorded",
    };

    private static string? RedactUri(Uri? value)
    {
        if (value is null)
        {
            return null;
        }

        var builder = new UriBuilder(value) { Query = string.Empty, Fragment = string.Empty };
        return builder.Uri.AbsoluteUri;
    }

    private sealed class RunProjection(PersistedWorkerRun persisted)
    {
        public object Gate { get; } = new();
        public SemaphoreSlim PersistenceGate { get; } = new(1, 1);
        public PersistedWorkerRun Persisted { get; set; } = persisted;
        public Guid ConcurrencyToken { get; set; } = persisted.ConcurrencyToken;
        public long LastSequence { get; set; } = persisted.LastCheckpointSequence;
        public string? BrowserSessionReference { get; set; } = persisted.BrowserSessionReference;
        public List<Checkpoint> Activity { get; } = [];

        public RunProjection Refresh(PersistedWorkerRun value)
        {
            lock (Gate)
            {
                if (value.LastCheckpointSequence < LastSequence)
                {
                    return this;
                }

                Persisted = value;
                ConcurrencyToken = value.ConcurrencyToken;
                LastSequence = value.LastCheckpointSequence;
                BrowserSessionReference ??= value.BrowserSessionReference;
                return this;
            }
        }
    }

    private sealed record StartRunPayload(
        Guid RunId,
        Guid ProfileId,
        Guid? ResumeId,
        Guid? JobApplicationId,
        string TargetUrl,
        DomainRunStatus Status,
        string Stage,
        DomainControlOwner ControlOwner,
        string? BrowserSessionReference);

    private sealed record CheckpointPayload(
        Guid ExpectedConcurrencyToken,
        long Sequence,
        DomainRunStatus Status,
        string Stage,
        DomainControlOwner ControlOwner,
        int RetryCount,
        string? BrowserSessionReference,
        string? CurrentUrl,
        string? CurrentDomain,
        JsonElement Summary);
}
