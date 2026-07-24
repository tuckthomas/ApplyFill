using System.Collections.Concurrent;
using System.Collections.Immutable;
using Microsoft.AspNetCore.SignalR;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Security;
using ResumeBuilder.BrowserWorker.Streaming;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public sealed partial class BrowserAgentRunService : IAsyncDisposable
{
    private sealed class Entry : IDisposable
    {
        public required ApplicationRun Run { get; init; }
        public required Guid SessionId { get; init; }
        public required string OwnerId { get; init; }
        public required IReadOnlySet<string> ApprovedDomains { get; init; }
        public required string? CompanyName { get; init; }
        public required string? JobTitle { get; init; }
        public required Uri TargetUri { get; init; }
        public DateTimeOffset UpdatedAt { get; set; }
        public OrchestrationYield? Yield { get; set; }
        public string? PendingQuestionId { get; set; }
        public CancellationTokenSource AgentCancellation { get; set; } = new();
        public Task? AgentTask { get; set; }
        public bool BrowserStopped { get; set; }
        public readonly SemaphoreSlim Gate = new(1, 1);

        public void Dispose()
        {
            AgentCancellation.Cancel();
            AgentCancellation.Dispose();
            Gate.Dispose();
        }
    }

    private const string LocalOwner = "local-user";
    private readonly ConcurrentDictionary<Guid, Entry> _runs = new();
    private readonly SemaphoreSlim _recoveryGate = new(1, 1);
    private readonly ApplicationRunOrchestrator _orchestrator;
    private readonly BrowserRunControl _control;
    private readonly IManagedBrowserRuntime _browser;
    private readonly IRunCheckpointStore _checkpoints;
    private readonly IWorkerRunStore _durableRuns;
    private readonly ISensitiveAnswerApprovalCoordinator _sensitiveApprovals;
    private readonly IApprovedArtifactStore _artifacts;
    private readonly IUserAnswerInbox _answers;
    private readonly IRunCredentialSource _credentials;
    private readonly SessionAccessRegistry _access;
    private readonly ControlLeaseManager _leases;
    private readonly LatestFrameStore _frames;
    private readonly IHubContext<BrowserAgentHub, IBrowserAgentClient> _hub;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<BrowserAgentRunService> _logger;

    public BrowserAgentRunService(
        ApplicationRunOrchestrator orchestrator,
        BrowserRunControl control,
        IManagedBrowserRuntime browser,
        IRunCheckpointStore checkpoints,
        IWorkerRunStore durableRuns,
        ISensitiveAnswerApprovalCoordinator sensitiveApprovals,
        IApprovedArtifactStore artifacts,
        IUserAnswerInbox answers,
        IRunCredentialSource credentials,
        SessionAccessRegistry access,
        ControlLeaseManager leases,
        LatestFrameStore frames,
        IHubContext<BrowserAgentHub, IBrowserAgentClient> hub,
        ILogger<BrowserAgentRunService> logger,
        TimeProvider? timeProvider = null)
    {
        _orchestrator = orchestrator;
        _control = control;
        _browser = browser;
        _checkpoints = checkpoints;
        _durableRuns = durableRuns;
        _sensitiveApprovals = sensitiveApprovals;
        _artifacts = artifacts;
        _answers = answers;
        _credentials = credentials;
        _access = access;
        _leases = leases;
        _frames = frames;
        _hub = hub;
        _logger = logger;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task<BrowserRunSnapshot> StartAsync(StartBrowserRunRequest request, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(request.TargetUrl, UriKind.Absolute, out var target) || target.Scheme != "https")
            throw new InvalidOperationException("Enter a secure job-application address that starts with https://.");
        if (request.ProfileId == Guid.Empty)
            throw new InvalidOperationException("Choose a saved profile before starting the Browser Agent.");
        if (request.ResumeId == Guid.Empty)
            throw new InvalidOperationException("The selected resume is not valid.");
        if (request.JobApplicationId == Guid.Empty)
            throw new InvalidOperationException("The selected tracked application is not valid.");
        var graph = new DomainGraph([target.IdnHost]);
        if (!graph.Contains(target)) throw new InvalidOperationException("That address cannot be opened in the private browser.");

        var runId = Guid.CreateVersion7();
        if (request.CredentialId is { } credentialId)
            await _credentials.PrepareAsync(runId, credentialId, cancellationToken);
        var persisted = await _durableRuns.StartOrGetAsync(
            new WorkerRunStart(runId, request.ProfileId, request.ResumeId, request.JobApplicationId, target),
            cancellationToken);
        var run = new ApplicationRun(persisted.RunId, LocalOwner, $"Complete the application at {target.IdnHost}", target,
            persisted.ProfileId, persisted.ResumeId ?? Guid.Empty, persisted.CreatedAt, jobApplicationId: persisted.JobApplicationId);
        var sessionStart = new BrowserSessionStart(target, LocalOwner, new HashSet<string>(StringComparer.OrdinalIgnoreCase) { target.IdnHost },
            ReuseProfile: true, ReusableProfileId: LocalOwner);
        BrowserSessionDescriptor session;
        try
        {
            session = await _orchestrator.InitializeAsync(run, sessionStart, cancellationToken);
        }
        catch
        {
            if (run.State != RunState.Failed && ApplicationRun.IsTransitionAllowed(run.State, RunState.Failed))
            {
                run.Transition(RunState.Failed, RunActor.System, "Browser could not be started", _timeProvider.GetUtcNow(), run.Version);
                try
                {
                    var latest = await _checkpoints.GetLatestAsync(run.Id, CancellationToken.None);
                    await _checkpoints.AppendAsync(new Checkpoint(
                        Guid.NewGuid(), run.Id, (latest?.Sequence ?? 0) + 1, run.State, "Starting browser", target, 0,
                        "Open application", "Application website", "browser-error", ControlOwner.None,
                        _timeProvider.GetUtcNow(), false, false), CancellationToken.None);
                }
                catch (HttpRequestException)
                {
                    // Preserve the original browser-start failure when the local API is also unavailable.
                }
                catch (TaskCanceledException)
                {
                    // Preserve the original browser-start failure when persistence times out.
                }
            }

            throw;
        }
        _access.Register(session.SessionId, LocalOwner);

        var entry = new Entry
        {
            Run = run,
            SessionId = session.SessionId,
            OwnerId = LocalOwner,
            ApprovedDomains = sessionStart.ApprovedDomains,
            CompanyName = CleanOptional(request.CompanyName),
            JobTitle = CleanOptional(request.JobTitle),
            TargetUri = target,
            UpdatedAt = _timeProvider.GetUtcNow()
        };
        if (!_runs.TryAdd(run.Id, entry)) throw new InvalidOperationException("Could not register the browser run.");
        BeginAgent(entry);
        return await SnapshotAsync(entry, cancellationToken);
    }

    public async Task<IReadOnlyList<BrowserRunSummary>> ListAsync(CancellationToken cancellationToken)
    {
        var snapshots = new List<BrowserRunSnapshot>(_runs.Count);
        foreach (var entry in _runs.Values.OrderByDescending(value => value.UpdatedAt))
            snapshots.Add(await SnapshotAsync(entry, cancellationToken));
        var summaries = snapshots.Select(snapshot => new BrowserRunSummary(snapshot.Id, snapshot.State, snapshot.CompanyName, snapshot.JobTitle,
            snapshot.CurrentDomain, snapshot.ApplicationStage, snapshot.UpdatedAt, snapshot.CanResume)).ToArray();
        var liveIds = _runs.Keys.ToHashSet();
        var recoverable = await _durableRuns.ListRecoverableAsync(100, cancellationToken);
        return summaries.Concat(recoverable
            .Where(run => !liveIds.Contains(run.RunId))
            .Select(ToRecoverableSummary))
            .OrderByDescending(run => run.UpdatedAt)
            .ToArray();
    }

    public async Task<BrowserRunSnapshot> RecoverAsync(Guid runId, CancellationToken cancellationToken)
    {
        if (_runs.TryGetValue(runId, out var existing))
        {
            return await SnapshotAsync(existing, cancellationToken);
        }

        await _recoveryGate.WaitAsync(cancellationToken);
        try
        {
            if (_runs.TryGetValue(runId, out existing))
            {
                return await SnapshotAsync(existing, cancellationToken);
            }

            var persisted = await _durableRuns.FindAsync(runId, cancellationToken)
                ?? throw new KeyNotFoundException("Browser run was not found.");
            if (persisted.Status is ResumeBuilder.Domain.ApplicationRuns.ApplicationRunStatus.Completed)
            {
                throw new InvalidOperationException("This application run is already finished.");
            }

            var original = new Uri(persisted.TargetUrl);
            var reopen = Uri.TryCreate(persisted.CurrentUrl, UriKind.Absolute, out var current) && current.Scheme == Uri.UriSchemeHttps
                ? current
                : original;
            var approvedDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                original.IdnHost,
                reopen.IdnHost,
            };
            var run = new ApplicationRun(
                persisted.RunId,
                LocalOwner,
                $"Continue the application at {original.IdnHost}",
                original,
                persisted.ProfileId,
                persisted.ResumeId ?? Guid.Empty,
                persisted.CreatedAt,
                jobApplicationId: persisted.JobApplicationId,
                submissionAttempted: persisted.Status == ResumeBuilder.Domain.ApplicationRuns.ApplicationRunStatus.Submitting);
            var sessionStart = new BrowserSessionStart(
                reopen,
                LocalOwner,
                approvedDomains,
                ReuseProfile: true,
                ReusableProfileId: LocalOwner);
            var session = await _orchestrator.InitializeAsync(run, sessionStart, cancellationToken);
            _access.Register(session.SessionId, LocalOwner);
            var entry = new Entry
            {
                Run = run,
                SessionId = session.SessionId,
                OwnerId = LocalOwner,
                ApprovedDomains = approvedDomains,
                CompanyName = null,
                JobTitle = null,
                TargetUri = original,
                UpdatedAt = _timeProvider.GetUtcNow(),
            };
            if (!_runs.TryAdd(run.Id, entry))
            {
                await _browser.StopAsync(session.SessionId, LocalOwner, cancellationToken);
                entry.Dispose();
                return await SnapshotAsync(_runs[run.Id], cancellationToken);
            }

            _control.Pause(run, session.SessionId);
            await PersistControlCheckpointAsync(entry, "recovered-paused", cancellationToken);
            return await SnapshotAsync(entry, cancellationToken);
        }
        finally
        {
            _recoveryGate.Release();
        }
    }

    public Task<BrowserRunSnapshot> GetAsync(Guid runId, CancellationToken cancellationToken) =>
        SnapshotAsync(GetEntry(runId), cancellationToken);

    public bool TryGetStreamingBinding(Guid runId, out Guid sessionId, out string ownerId)
    {
        if (_runs.TryGetValue(runId, out var entry) && !entry.BrowserStopped)
        {
            sessionId = entry.SessionId;
            ownerId = entry.OwnerId;
            return true;
        }
        sessionId = Guid.Empty;
        ownerId = string.Empty;
        return false;
    }

    public async Task<BrowserRunSnapshot> CommandAsync(Guid runId, BrowserRunCommandRequest request, CancellationToken cancellationToken)
    {
        var entry = GetEntry(runId);
        await entry.Gate.WaitAsync(cancellationToken);
        try
        {
            AssertRevision(entry, request.ExpectedRevision);
            var startAgentAfterCheckpoint = false;
            switch (request.Command)
            {
                case "pause":
                    entry.AgentCancellation.Cancel();
                    _control.Pause(entry.Run, entry.SessionId);
                    break;
                case "resume":
                case "return-control":
                    PrepareAgentResume(entry);
                    startAgentAfterCheckpoint = true;
                    break;
                case "take-control":
                    entry.AgentCancellation.Cancel();
                    _control.TakeControl(entry.Run, entry.SessionId);
                    break;
                case "stop":
                    entry.AgentCancellation.Cancel();
                    await _control.StopAsync(entry.Run, entry.SessionId, entry.OwnerId, cancellationToken);
                    _sensitiveApprovals.ClearRun(entry.Run.Id);
                    await _artifacts.ReleaseRunAsync(entry.Run.Id, cancellationToken);
                    entry.BrowserStopped = true;
                    break;
                case "approve-submit":
                    await ApproveAndSubmitAsync(entry, cancellationToken);
                    break;
                default:
                    throw new InvalidOperationException("That browser command is not supported.");
            }
            entry.UpdatedAt = _timeProvider.GetUtcNow();
            if (request.Command != "approve-submit")
            {
                await PersistControlCheckpointAsync(entry, request.Command, cancellationToken);
            }
            if (startAgentAfterCheckpoint)
            {
                BeginAgent(entry);
            }
        }
        finally
        {
            entry.Gate.Release();
        }

        var snapshot = await SnapshotAsync(entry, cancellationToken);
        await PublishAsync(entry.Run.Id, snapshot);
        return snapshot;
    }

    public async Task<BrowserRunSnapshot> AnswerQuestionAsync(
        Guid runId,
        string questionId,
        BrowserQuestionAnswerRequest request,
        CancellationToken cancellationToken)
    {
        var entry = GetEntry(runId);
        await entry.Gate.WaitAsync(cancellationToken);
        try
        {
            AssertRevision(entry, request.ExpectedRevision);
            if (entry.PendingQuestionId != questionId) throw new InvalidOperationException("That question is no longer active.");
            var currentYield = entry.Yield ?? throw new InvalidOperationException("That question is no longer active.");
            if (string.IsNullOrWhiteSpace(request.OptionId) && string.IsNullOrWhiteSpace(request.Value))
                throw new InvalidOperationException("Choose or enter an answer before continuing.");

            var resumeAgent = false;
            var checkpointCode = "answer-needs-manual-entry";
            if (currentYield.SensitiveApproval is { } sensitiveApproval)
            {
                if (request.OptionId == "approve")
                {
                    var consumed = await _sensitiveApprovals.ConsumeApprovedAsync(
                        entry.Run.Id,
                        sensitiveApproval.ApprovalId,
                        sensitiveApproval.ControlId,
                        cancellationToken);
                    if (!consumed)
                    {
                        throw new InvalidOperationException("Approve this saved answer in ApplyFill before continuing.");
                    }
                    resumeAgent = true;
                    checkpointCode = "sensitive-answer-approved";
                }
                else if (request.OptionId == "deny")
                {
                    _sensitiveApprovals.Dismiss(entry.Run.Id, sensitiveApproval.ApprovalId, sensitiveApproval.ControlId);
                    _control.TakeControl(entry.Run, entry.SessionId);
                    checkpointCode = "sensitive-answer-declined";
                }
                else
                {
                    throw new InvalidOperationException("Choose whether ApplyFill may use this saved answer for this application.");
                }
            }
            else
            {
                if (request.SaveToProfile)
                    throw new InvalidOperationException("Saving a new answer to your profile is not available from the Browser Agent yet.");

                var value = ResolveAnswerValue(currentYield, request);
                var target = ResolveAnswerControl(currentYield, value);
                if (target is null)
                {
                    _control.TakeControl(entry.Run, entry.SessionId);
                }
                else
                {
                    _answers.Put(new UserAnswer(
                        runId,
                        questionId,
                        target.Handle,
                        target.Label ?? target.Handle,
                        value,
                        _timeProvider.GetUtcNow()));
                    resumeAgent = true;
                    checkpointCode = "answer-received";
                }
            }

            if (resumeAgent)
            {
                PrepareAgentResume(entry);
            }
            entry.PendingQuestionId = null;
            entry.Yield = null;
            await PersistControlCheckpointAsync(entry, checkpointCode, cancellationToken);
            if (resumeAgent)
            {
                BeginAgent(entry);
            }
            entry.UpdatedAt = _timeProvider.GetUtcNow();
        }
        finally
        {
            entry.Gate.Release();
        }

        var snapshot = await SnapshotAsync(entry, cancellationToken);
        await PublishAsync(runId, snapshot);
        return snapshot;
    }

    public async Task SendInputAsync(Guid runId, BrowserInputRequest request, CancellationToken cancellationToken)
    {
        var entry = GetEntry(runId);
        var currentFrame = _frames.GetByRun(runId) ?? throw new InvalidOperationException("Wait until the private browser is visible before controlling it.");
        var acknowledgedFrame = _frames.GetByRun(runId, request.FrameSequence) ??
            throw new InvalidOperationException("The visible page is too old. Wait for the live view to refresh.");
        var lease = _leases.Get(entry.SessionId);
        var input = BrowserInputMapper.Map(request, acknowledgedFrame, currentFrame);
        await _browser.RelayInputAsync(entry.SessionId, entry.OwnerId, lease.Epoch, input, cancellationToken);
    }

    public async Task DeleteAsync(Guid runId, CancellationToken cancellationToken)
    {
        if (!_runs.TryRemove(runId, out var entry)) throw new KeyNotFoundException("Browser run was not found.");
        entry.AgentCancellation.Cancel();
        if (!entry.BrowserStopped)
            await _browser.StopAsync(entry.SessionId, entry.OwnerId, cancellationToken);
        _access.Revoke(entry.SessionId);
        _frames.Remove(runId, entry.SessionId);
        _sensitiveApprovals.ClearRun(runId);
        _answers.Remove(runId);
        await _artifacts.ReleaseRunAsync(runId, cancellationToken);
        await _checkpoints.DeleteAsync(runId, cancellationToken);
        entry.Dispose();
    }

    public ViewportFrame? GetLatestFrame(Guid runId) => _runs.ContainsKey(runId) ? _frames.GetByRun(runId) : null;

    public ViewportFrame? GetFrame(Guid runId, long sequence) =>
        _runs.ContainsKey(runId) ? _frames.GetByRun(runId, sequence) : null;

    public async ValueTask DisposeAsync()
    {
        var entries = _runs.Values.ToArray();
        foreach (var entry in entries) entry.AgentCancellation.Cancel();
        await Task.WhenAll(entries.Select(entry => entry.AgentTask ?? Task.CompletedTask));
        foreach (var entry in entries) entry.Dispose();
        _runs.Clear();
        _recoveryGate.Dispose();
    }

    private void BeginAgent(Entry entry)
    {
        entry.AgentTask = CompleteAgentTurnAsync(entry, entry.AgentCancellation.Token);
    }

    private void PrepareAgentResume(Entry entry)
    {
        entry.AgentCancellation.Cancel();
        entry.AgentCancellation.Dispose();
        entry.AgentCancellation = new CancellationTokenSource();
        _control.Resume(entry.Run, entry.SessionId);
    }

    private async Task CompleteAgentTurnAsync(Entry entry, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _orchestrator.RunUntilYieldAsync(entry.Run, entry.SessionId, entry.OwnerId, entry.ApprovedDomains, cancellationToken);
            entry.Yield = result;
            entry.PendingQuestionId = result.UserQuestion is null
                ? null
                : result.SensitiveApproval?.ApprovalId.ToString("N") ?? Guid.NewGuid().ToString("N");
            entry.UpdatedAt = _timeProvider.GetUtcNow();
            await PublishAsync(entry.Run.Id, await SnapshotAsync(entry, CancellationToken.None));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (BrowserRuntimeException exception)
        {
            LogRunFailure(_logger, entry.Run.Id, exception.Code);
            if (entry.Run.State is not (RunState.Completed or RunState.Stopped or RunState.Failed) &&
                ApplicationRun.IsTransitionAllowed(entry.Run.State, RunState.Failed))
                entry.Run.Transition(RunState.Failed, RunActor.System, exception.Code, _timeProvider.GetUtcNow(), entry.Run.Version);
            entry.Yield = new OrchestrationYield(
                entry.Run.State,
                exception.Code,
                $"{exception.Message} Recover this application from its last saved step.");
            entry.UpdatedAt = _timeProvider.GetUtcNow();
            try
            {
                await PersistControlCheckpointAsync(entry, exception.Code, CancellationToken.None);
            }
            catch (HttpRequestException)
            {
                // The content-free browser failure remains visible when durable persistence is unavailable.
            }
            catch (TaskCanceledException)
            {
                // The content-free browser failure remains visible when durable persistence times out.
            }
            await PublishAsync(entry.Run.Id, await SnapshotAsync(entry, CancellationToken.None));
        }
        catch (Exception exception)
        {
            LogRunFailure(_logger, entry.Run.Id, exception.GetType().Name);
            if (entry.Run.State is not (RunState.Completed or RunState.Stopped or RunState.Failed) &&
                ApplicationRun.IsTransitionAllowed(entry.Run.State, RunState.Failed))
                entry.Run.Transition(RunState.Failed, RunActor.System, "Browser agent failed", _timeProvider.GetUtcNow(), entry.Run.Version);
            entry.Yield = new OrchestrationYield(entry.Run.State, "run-failed", "The browser agent stopped safely. You can inspect the page or try again.");
            entry.UpdatedAt = _timeProvider.GetUtcNow();
            try
            {
                await PersistControlCheckpointAsync(entry, "run-failed", CancellationToken.None);
            }
            catch (HttpRequestException)
            {
                // The browser failure remains visible even when durable persistence is unavailable.
            }
            catch (TaskCanceledException)
            {
                // The browser failure remains visible even when durable persistence times out.
            }
            await PublishAsync(entry.Run.Id, await SnapshotAsync(entry, CancellationToken.None));
        }
    }

    private async Task ApproveAndSubmitAsync(Entry entry, CancellationToken cancellationToken)
    {
        if (entry.Run.State != RunState.ReviewReady) throw new InvalidOperationException("The application is not at final review.");
        entry.Run.ApproveSubmission(RunActor.User, _timeProvider.GetUtcNow(), entry.Run.Version);
        var currentLease = _leases.Get(entry.SessionId);
        if (currentLease.Owner == ControlOwner.User)
        {
            _leases.Release(entry.SessionId, ControlOwner.User);
            _leases.AcquireAgent(entry.SessionId);
        }
        var observation = await _browser.ObserveAsync(entry.SessionId, entry.OwnerId, cancellationToken);
        var submit = observation.Controls.FirstOrDefault(control => control.Role == "button" &&
            (control.Label ?? string.Empty).Contains("submit", StringComparison.OrdinalIgnoreCase));
        if (submit is null) throw new InvalidOperationException("The final submit button could not be identified safely.");
        entry.Yield = await _orchestrator.SubmitAsync(entry.Run, entry.SessionId, entry.OwnerId, entry.ApprovedDomains,
            new BrowserAction(BrowserActionKind.Click, observation.PageGeneration, submit.Handle, ExpectedResult: "Submission confirmation appears."),
            cancellationToken);
    }

    private async Task<BrowserRunSnapshot> SnapshotAsync(Entry entry, CancellationToken cancellationToken)
    {
        var activity = (await _checkpoints.GetActivityAsync(entry.Run.Id, cancellationToken))
            .TakeLast(25)
            .Select(checkpoint => new BrowserAgentActivity(checkpoint.Id.ToString(), checkpoint.CreatedAt,
                FriendlyIntent(checkpoint.Intent), FriendlyDetail(checkpoint.Result), ActivityKind(checkpoint)))
            .ToArray();
        var frame = _frames.GetByRun(entry.Run.Id);
        var state = MapState(entry.Run.State);
        var lease = _leases.Get(entry.SessionId);
        var uri = entry.Run.CurrentUri ?? entry.TargetUri;
        var question = entry.PendingQuestionId is null || entry.Yield?.UserQuestion is null ? null : BuildQuestion(entry);
        var review = entry.Run.State is RunState.ReviewReady or RunState.Submitting or RunState.Completed
            ? new BrowserRunReview([], null, null, [], [], entry.Yield?.Code == "submission-not-verified" ? ["Submission could not be verified and was not retried."] : [], entry.Run.SubmissionApproved)
            : null;

        return new BrowserRunSnapshot(
            entry.Run.Id.ToString(), entry.Run.Version, state, lease.Owner.ToString().ToLowerInvariant(), entry.CompanyName, entry.JobTitle,
            uri.AbsoluteUri, uri.Host, entry.Run.PageStage, StatusMessage(entry), ControlReason(entry.Run.State),
            entry.Run.State == RunState.AgentRunning ? "Working on the current application step" : null,
            entry.UpdatedAt, frame?.CapturedAt, frame?.Width, frame?.Height,
            frame?.Sequence, frame?.PageGeneration, frame?.DeviceScaleFactor,
            frame is null ? null : $"/api/browser-agent/runs/{entry.Run.Id}/frame/latest?sequence={frame.Sequence}",
            question, activity, review,
            entry.Run.State is RunState.Paused or RunState.UserControl or RunState.AwaitingUser or RunState.Failed,
            activity.Length > 0);
    }

    private static BrowserAgentQuestion BuildQuestion(Entry entry)
    {
        if (entry.Yield!.SensitiveApproval is { } approval)
        {
            return new BrowserAgentQuestion(
                entry.PendingQuestionId!,
                entry.Yield.UserQuestion!,
                entry.Yield.Message,
                "sensitive-approval",
                [
                    new BrowserAgentQuestionOption("approve", "Use saved answer", $"Use {approval.MaskedValue} for this application only."),
                    new BrowserAgentQuestionOption("deny", "Do not use it", "Take control and answer this field yourself."),
                ],
                AllowFreeText: false,
                CanSaveToProfile: false,
                approval.ApprovalId.ToString("D"),
                approval.ConcurrencyToken.ToString("D"),
                approval.MaskedValue);
        }

        var options = entry.Yield!.VisibleOptions.IsDefaultOrEmpty
            ? null
            : entry.Yield.VisibleOptions.Select((label, index) => new BrowserAgentQuestionOption(index.ToString(), label, null)).ToArray();
        return new BrowserAgentQuestion(entry.PendingQuestionId!, entry.Yield.UserQuestion!,
            entry.Yield.Message, QuestionCategory(entry.Yield.Code), options, options is null, CanSaveToProfile: false);
    }

    internal static string ResolveAnswerValue(OrchestrationYield yield, BrowserQuestionAnswerRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Value))
        {
            return request.Value.Trim();
        }

        if (int.TryParse(request.OptionId, out var optionIndex) &&
            optionIndex >= 0 &&
            optionIndex < yield.VisibleOptions.Length)
        {
            return yield.VisibleOptions[optionIndex];
        }

        throw new InvalidOperationException("Choose one of the answers shown before continuing.");
    }

    internal static VisibleControl? ResolveAnswerControl(OrchestrationYield yield, string value)
    {
        if (yield.Observation is null)
        {
            return null;
        }

        var candidates = yield.Observation.Controls
            .Where(control =>
                control.Required &&
                control.Enabled &&
                !control.Sensitive &&
                string.IsNullOrWhiteSpace(control.CurrentValue))
            .ToArray();

        var optionMatches = candidates
            .Where(control => control.Options.Any(option => option.Equals(value, StringComparison.OrdinalIgnoreCase)))
            .ToArray();
        if (optionMatches.Length == 1)
        {
            return optionMatches[0];
        }

        var normalizedQuestion = Normalize(yield.UserQuestion);
        var labelMatches = candidates
            .Where(control =>
            {
                var label = Normalize(control.Label);
                return label.Length >= 3 && normalizedQuestion.Contains(label, StringComparison.Ordinal);
            })
            .ToArray();
        if (labelMatches.Length == 1)
        {
            return labelMatches[0];
        }

        return candidates.Length == 1 ? candidates[0] : null;
    }

    private static string Normalize(string? entry) => new((entry ?? string.Empty)
        .Where(char.IsLetterOrDigit)
        .Select(char.ToLowerInvariant)
        .ToArray());

    private async Task PublishAsync(Guid runId, BrowserRunSnapshot snapshot) =>
        await _hub.Clients.Group(ViewportStreamCoordinator.GroupName(runId)).RunUpdated(snapshot);

    private async Task PersistControlCheckpointAsync(
        Entry entry,
        string command,
        CancellationToken cancellationToken)
    {
        var latest = await _checkpoints.GetLatestAsync(entry.Run.Id, cancellationToken);
        await _checkpoints.AppendAsync(new Checkpoint(
            Guid.NewGuid(),
            entry.Run.Id,
            (latest?.Sequence ?? 0) + 1,
            entry.Run.State,
            entry.Run.PageStage,
            entry.Run.CurrentUri ?? entry.TargetUri,
            entry.Run.PageGeneration,
            "User command",
            "Browser Agent",
            command,
            _leases.Get(entry.SessionId).Owner,
            _timeProvider.GetUtcNow(),
            entry.Run.SubmissionApproved,
            entry.Run.SubmissionAttempted), cancellationToken);
    }

    private Entry GetEntry(Guid runId) => _runs.TryGetValue(runId, out var entry)
        ? entry
        : throw new KeyNotFoundException("Browser run was not found.");

    private static void AssertRevision(Entry entry, long expected)
    {
        if (entry.Run.Version != expected) throw new RunConcurrencyException(expected, entry.Run.Version);
    }

    private static string MapState(RunState state) => state switch
    {
        RunState.Created or RunState.StartingBrowser or RunState.Navigating or RunState.Observing or RunState.Planning => "ready",
        RunState.AgentRunning => "agent-running",
        RunState.Pausing => "pausing",
        RunState.Paused => "paused",
        RunState.UserControl => "user-control",
        RunState.AwaitingUser => "waiting-for-user",
        RunState.Recovering => "recovering",
        RunState.ReviewReady => "ready-for-review",
        RunState.Submitting => "submitting",
        RunState.Stopped => "stopped",
        RunState.Completed => "completed",
        RunState.Failed => "failed",
        _ => "failed"
    };

    private static BrowserRunSummary ToRecoverableSummary(PersistedWorkerRun run)
    {
        var current = Uri.TryCreate(run.CurrentUrl ?? run.TargetUrl, UriKind.Absolute, out var uri)
            ? uri
            : new Uri(run.TargetUrl);
        return new BrowserRunSummary(
            run.RunId.ToString(),
            "paused",
            CompanyName: null,
            JobTitle: null,
            current.Host,
            run.Stage,
            run.UpdatedAt,
            CanResume: true);
    }

    private static string StatusMessage(Entry entry) =>
        entry.Run.SubmissionAttempted && entry.Run.State != RunState.Completed
            ? "A submission may already have been sent before recovery. ApplyFill will not submit this application again."
            : entry.Yield?.Message ?? entry.Run.State switch
            {
                RunState.Observing or RunState.Planning or RunState.AgentRunning => "ApplyFill is working on this application.",
                RunState.Paused => "Application help is paused.",
                RunState.UserControl => "You are controlling the application.",
                RunState.ReviewReady => "The application is ready for your final review.",
                RunState.Completed => "The application is complete.",
                RunState.Stopped => "This application run is stopped.",
                _ => "The private browser is ready."
            };

    private static string? ControlReason(RunState state) => state switch
    {
        RunState.UserControl => "ApplyFill will not click or type until you return control.",
        RunState.Paused => "Resume when you are ready.",
        RunState.AwaitingUser => "ApplyFill needs your answer before continuing.",
        _ => null
    };

    private static string FriendlyIntent(string intent) => intent switch
    {
        "Type" => "Answered a field",
        "Select" => "Selected an answer",
        "Check" => "Updated a choice",
        "Click" => "Continued to the next step",
        _ => intent
    };

    private static string? FriendlyDetail(string result) => result switch
    {
        "verified" => "The page confirmed the change.",
        "navigation-started" => "The next application step opened.",
        _ when result.Length <= 120 => result,
        _ => null
    };

    private static string ActivityKind(Checkpoint checkpoint) => checkpoint.Result switch
    {
        "verified" or "navigation-started" => "completed",
        var value when value.Contains("required", StringComparison.OrdinalIgnoreCase) => "question",
        var value when value.Contains("failed", StringComparison.OrdinalIgnoreCase) => "error",
        _ => "current"
    };

    private static string QuestionCategory(string code) => code switch
    {
        "user-input-required" => "sensitive",
        "unsupported" => "unsupported",
        _ => "choice"
    };

    private static string? CleanOptional(string? value)
    {
        value = value?.Trim();
        if (string.IsNullOrEmpty(value)) return null;
        return value.Length <= 200 ? value : value[..200];
    }

    [LoggerMessage(LogLevel.Error, "Browser run {RunId} failed safely ({FailureType}).")]
    private static partial void LogRunFailure(ILogger logger, Guid runId, string failureType);
}
