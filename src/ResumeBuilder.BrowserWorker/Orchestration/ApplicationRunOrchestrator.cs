using System.Collections.Immutable;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Security;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public enum PlannerDecisionKind
{
    Action,
    AskUser,
    ReviewReady,
    Completed,
    Unsupported
}

public sealed record RelevantAnswer(string Field, string Value, bool Sensitive, bool ApprovedForThisApplication);

public sealed record SensitiveAnswerApprovalPrompt(
    Guid ApprovalId,
    Guid ConcurrencyToken,
    string ControlId,
    string Field,
    string DisplayName,
    string MaskedValue);

public sealed record RelevantAnswerLookup(
    ImmutableArray<RelevantAnswer> Answers,
    SensitiveAnswerApprovalPrompt? PendingSensitiveApproval = null);

public sealed record PlanningContext(
    Guid RunId,
    string Objective,
    string PageStage,
    PageObservation Observation,
    ImmutableArray<RelevantAnswer> RelevantAnswers,
    int RemainingActions,
    int RemainingModelCalls);

public sealed record PlannerDecision(
    PlannerDecisionKind Kind,
    BrowserAction? Action = null,
    string? Question = null,
    ImmutableArray<string> VisibleOptions = default,
    string? Reason = null);

public interface IApplicationPlanner
{
    Task<PlannerDecision> PlanAsync(PlanningContext context, CancellationToken cancellationToken);
}

public interface IRelevantAnswerSource
{
    Task<RelevantAnswerLookup> GetForVisibleControlsAsync(
        Guid runId,
        Guid profileId,
        IReadOnlyList<VisibleControl> controls,
        CancellationToken cancellationToken);
}

public interface ISensitiveAnswerApprovalCoordinator
{
    Task<bool> ConsumeApprovedAsync(
        Guid runId,
        Guid approvalId,
        string controlId,
        CancellationToken cancellationToken);

    void Dismiss(Guid runId, Guid approvalId, string controlId);

    void MarkUsed(Guid runId, string controlId);

    void ClearRun(Guid runId);
}

public interface IDeterministicActionResolver
{
    BrowserAction? Resolve(
        PageObservation observation,
        IReadOnlyList<RelevantAnswer> answers,
        ApprovedArtifact? approvedArtifact = null);
}

public sealed class DeterministicActionResolver : IDeterministicActionResolver
{
    public BrowserAction? Resolve(
        PageObservation observation,
        IReadOnlyList<RelevantAnswer> answers,
        ApprovedArtifact? approvedArtifact = null)
    {
        foreach (var control in observation.Controls.Where(control => control.Enabled && control.Required && string.IsNullOrWhiteSpace(control.CurrentValue)))
        {
            if (control.Type?.Equals("file", StringComparison.OrdinalIgnoreCase) == true && approvedArtifact is not null)
            {
                return new BrowserAction(
                    BrowserActionKind.UploadApprovedArtifact,
                    observation.PageGeneration,
                    control.Handle,
                    ArtifactId: approvedArtifact.Id,
                    ExpectedResult: "The application shows the approved resume filename.");
            }

            var label = Normalize(control.Label);
            var answer = answers.FirstOrDefault(candidate => Normalize(candidate.Field) == label && (!candidate.Sensitive || candidate.ApprovedForThisApplication));
            if (answer is null) continue;
            return new BrowserAction(
                control.Role is "checkbox" or "radio" ? BrowserActionKind.Check : control.Role == "combobox" ? BrowserActionKind.Select : BrowserActionKind.Type,
                observation.PageGeneration,
                control.Handle,
                Value: answer.Value,
                Checked: control.Role is "checkbox" or "radio" ? ParseChecked(answer.Value) : null,
                ExpectedResult: "The visible field contains the selected profile answer.");
        }

        return null;
    }

    private static string Normalize(string? value) => new((value ?? string.Empty)
        .Where(character => char.IsLetterOrDigit(character))
        .Select(char.ToLowerInvariant)
        .ToArray());

    private static bool ParseChecked(string value) => value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                                                       value.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
                                                       value == "1";
}

public sealed record OrchestrationYield(
    RunState State,
    string Code,
    string Message,
    PageObservation? Observation = null,
    string? UserQuestion = null,
    ImmutableArray<string> VisibleOptions = default,
    SensitiveAnswerApprovalPrompt? SensitiveApproval = null);

public sealed class ApplicationRunOrchestrator
{
    private readonly IManagedBrowserRuntime _browser;
    private readonly IRunCheckpointStore _checkpoints;
    private readonly IApplicationPlanner _planner;
    private readonly IRelevantAnswerSource _answers;
    private readonly IUserAnswerInbox _userAnswers;
    private readonly IApprovedArtifactStore _artifacts;
    private readonly IDeterministicActionResolver _deterministic;
    private readonly BrowserActionPolicy _policy;
    private readonly ControlLeaseManager _leases;
    private readonly TimeProvider _timeProvider;

    public ApplicationRunOrchestrator(
        IManagedBrowserRuntime browser,
        IRunCheckpointStore checkpoints,
        IApplicationPlanner planner,
        IRelevantAnswerSource answers,
        IUserAnswerInbox userAnswers,
        IApprovedArtifactStore artifacts,
        IDeterministicActionResolver deterministic,
        BrowserActionPolicy policy,
        ControlLeaseManager leases,
        TimeProvider? timeProvider = null)
    {
        _browser = browser;
        _checkpoints = checkpoints;
        _planner = planner;
        _answers = answers;
        _userAnswers = userAnswers;
        _artifacts = artifacts;
        _deterministic = deterministic;
        _policy = policy;
        _leases = leases;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task<(Guid SessionId, OrchestrationYield Yield)> StartAsync(
        ApplicationRun run,
        BrowserSessionStart sessionStart,
        CancellationToken cancellationToken)
    {
        var session = await InitializeAsync(run, sessionStart, cancellationToken);
        var result = await RunUntilYieldAsync(run, session.SessionId, sessionStart.OwnerId, sessionStart.ApprovedDomains, cancellationToken);
        return (session.SessionId, result);
    }

    public async Task<BrowserSessionDescriptor> InitializeAsync(
        ApplicationRun run,
        BrowserSessionStart sessionStart,
        CancellationToken cancellationToken)
    {
        Transition(run, RunState.StartingBrowser, RunActor.System, "Starting the private browser");
        var session = await _browser.StartAsync(run.Id, sessionStart, cancellationToken);
        if (_checkpoints is IWorkerRunStore durableRuns)
        {
            durableRuns.AttachBrowserSession(run.Id, session.SessionId);
        }
        Transition(run, RunState.Navigating, RunActor.System, "Opening the application");
        await CheckpointAsync(run, "Open application", "Application website", "Browser session started", ControlOwner.Agent, cancellationToken);
        Transition(run, RunState.Observing, RunActor.System, "Application page loaded");
        return session;
    }

    public async Task<OrchestrationYield> RunUntilYieldAsync(
        ApplicationRun run,
        Guid sessionId,
        string ownerId,
        IReadOnlySet<string> approvedDomains,
        CancellationToken cancellationToken)
    {
        var lease = _leases.Get(sessionId);
        if (lease.Owner != ControlOwner.Agent)
            (lease, _) = _leases.AcquireAgent(sessionId);
        var graph = new DomainGraph(approvedDomains);

        while (!cancellationToken.IsCancellationRequested)
        {
            var violation = run.GetLimitViolation(_timeProvider.GetUtcNow());
            if (violation is not null)
            {
                Transition(run, RunState.AwaitingUser, RunActor.System, $"Run paused at {violation}");
                await CheckpointAsync(run, "Safety limit", run.PageStage, violation, ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(run.State, violation, "The browser paused because it could not make safe progress.");
            }

            cancellationToken.ThrowIfCancellationRequested();
            if (run.State != RunState.Observing)
                Transition(run, RunState.Observing, RunActor.System, "Reading the current application page");

            var observation = await _browser.ObserveAsync(sessionId, ownerId, cancellationToken);
            run.RecordObservation(observation.Uri, observation.PageGeneration, DescribeStage(observation));

            if (_policy.RequiresImmediateUserHandoff(observation))
            {
                Transition(run, RunState.AwaitingUser, RunActor.System, $"User input is required for {observation.Kind}");
                await CheckpointAsync(run, "Request user input", run.PageStage, observation.Kind.ToString(), ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(run.State, "user-input-required",
                    "This step needs you before the browser can continue.", observation,
                    BuildUserQuestion(observation), VisibleOptions(observation));
            }

            RelevantAnswerLookup? answerLookup = null;
            if (observation.Controls.Any(control => control.Sensitive))
            {
                answerLookup = await _answers.GetForVisibleControlsAsync(
                    run.Id,
                    run.ProfileId,
                    observation.Controls,
                    cancellationToken);
                if (answerLookup.PendingSensitiveApproval is { } pendingApproval)
                {
                    Transition(run, RunState.AwaitingUser, RunActor.Agent, "A saved sensitive answer requires approval");
                    await CheckpointAsync(run, "Request sensitive approval", run.PageStage, "sensitive-approval-required", ControlOwner.Agent, cancellationToken);
                    return new OrchestrationYield(
                        run.State,
                        "sensitive-approval-required",
                        $"ApplyFill found a saved {pendingApproval.DisplayName} ending in {pendingApproval.MaskedValue}. Approve it for this application or take control.",
                        observation,
                        $"Use the saved {pendingApproval.DisplayName} for this one application?",
                        ["Use saved answer", "Do not use it"],
                        pendingApproval);
                }

            }

            var approvedSensitiveFields = answerLookup?.Answers
                .Where(answer => answer.Sensitive && answer.ApprovedForThisApplication)
                .Select(answer => answer.Field)
                .ToArray();
            if (_policy.RequiresUserHandoff(observation, approvedSensitiveFields))
            {
                Transition(run, RunState.AwaitingUser, RunActor.System, $"User input is required for {observation.Kind}");
                await CheckpointAsync(run, "Request user input", run.PageStage, observation.Kind.ToString(), ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(run.State, "user-input-required",
                    "This step needs you before the browser can continue.", observation,
                    BuildUserQuestion(observation), VisibleOptions(observation));
            }

            if (observation.Kind == PageKind.Confirmation)
            {
                Transition(run, RunState.Completed, RunActor.System, "Application confirmation detected");
                await CheckpointAsync(run, "Confirm completion", run.PageStage, "Application confirmation detected", ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(run.State, "completed", "The application website confirmed completion.", observation);
            }

            if (observation.Kind == PageKind.Review)
            {
                Transition(run, RunState.ReviewReady, RunActor.System, "Final review detected");
                await CheckpointAsync(run, "Final review", run.PageStage, "Waiting for submission approval", ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(run.State, "review-ready", "The application is ready for your final review.", observation);
            }

            Transition(run, RunState.Planning, RunActor.Agent, "Selecting the next safe action");
            answerLookup ??= await _answers.GetForVisibleControlsAsync(run.Id, run.ProfileId, observation.Controls, cancellationToken);

            var relevantAnswers = answerLookup.Answers;
            UserAnswer? userAnswer = null;
            if (_userAnswers.TryGet(run.Id, out userAnswer) &&
                userAnswer is not null &&
                observation.Controls.Any(control =>
                    control.Handle == userAnswer.ControlId &&
                    control.Enabled &&
                    !control.Sensitive &&
                    string.IsNullOrWhiteSpace(control.CurrentValue)))
            {
                relevantAnswers = relevantAnswers.Add(new RelevantAnswer(
                    userAnswer.Field,
                    userAnswer.Value,
                    Sensitive: false,
                    ApprovedForThisApplication: true));
            }
            var selectedArtifact = observation.Controls.Any(control =>
                    control.Enabled &&
                    control.Required &&
                    string.IsNullOrWhiteSpace(control.CurrentValue) &&
                    control.Type?.Equals("file", StringComparison.OrdinalIgnoreCase) == true)
                ? await _artifacts.GetLatestForRunAsync(run.Id, run.ResumeArtifactId, cancellationToken)
                : null;
            var action = _deterministic.Resolve(observation, relevantAnswers, selectedArtifact);
            PlannerDecision decision;
            if (action is not null)
            {
                decision = new PlannerDecision(PlannerDecisionKind.Action, action);
            }
            else
            {
                run.RecordModelCall();
                decision = await _planner.PlanAsync(new PlanningContext(run.Id, run.Objective, run.PageStage, observation,
                    relevantAnswers.Where(answer => !answer.Sensitive).ToImmutableArray(),
                    run.Limits.MaxActions - run.ActionCount,
                    run.Limits.MaxModelCalls - run.ModelCallCount), cancellationToken);
            }

            switch (decision.Kind)
            {
                case PlannerDecisionKind.AskUser:
                    Transition(run, RunState.AwaitingUser, RunActor.Agent, "A required answer is unavailable or ambiguous");
                    await CheckpointAsync(run, "Ask user", run.PageStage, decision.Reason ?? "Answer required", ControlOwner.Agent, cancellationToken);
                    return new OrchestrationYield(run.State, "answer-required", decision.Reason ?? "A required answer is missing.", observation,
                        decision.Question, decision.VisibleOptions);
                case PlannerDecisionKind.ReviewReady:
                    Transition(run, RunState.ReviewReady, RunActor.Agent, "Planner identified final review");
                    await CheckpointAsync(run, "Final review", run.PageStage, decision.Reason ?? "Ready", ControlOwner.Agent, cancellationToken);
                    return new OrchestrationYield(run.State, "review-ready", "The application is ready for your final review.", observation);
                case PlannerDecisionKind.Completed:
                    Transition(run, RunState.Completed, RunActor.System, "Planner found terminal confirmation evidence");
                    await CheckpointAsync(run, "Confirm completion", run.PageStage, decision.Reason ?? "Complete", ControlOwner.Agent, cancellationToken);
                    return new OrchestrationYield(run.State, "completed", "The application is complete.", observation);
                case PlannerDecisionKind.Unsupported:
                    Transition(run, RunState.AwaitingUser, RunActor.Agent, "Page cannot be handled safely");
                    await CheckpointAsync(run, "Unsupported page", run.PageStage, decision.Reason ?? "Unsupported", ControlOwner.Agent, cancellationToken);
                    return new OrchestrationYield(run.State, "unsupported", "This page needs you to continue.", observation);
                case PlannerDecisionKind.Action when decision.Action is not null:
                    action = decision.Action;
                    break;
                default:
                    throw new InvalidOperationException("Planner returned an invalid decision.");
            }

            var artifact = action.ArtifactId is { } artifactId
                ? await _artifacts.GetVerifiedAsync(artifactId, run.Id, cancellationToken)
                : null;
            var policy = _policy.Validate(action, observation, graph, ControlOwner.Agent, artifact,
                perApplicationSensitiveApproval: IsApprovedSensitiveAction(action, observation, relevantAnswers),
                finalSubmissionApproved: run.SubmissionApproved);
            if (!policy.Allowed)
            {
                run.RecordAction(false, false);
                Transition(run, RunState.AwaitingUser, RunActor.System, policy.Code);
                await CheckpointAsync(run, "Policy denied action", action.Handle ?? action.Kind.ToString(), policy.Code, ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(run.State, policy.Code, policy.Message, observation);
            }

            Transition(run, RunState.AgentRunning, RunActor.Agent, "Executing one verified action");
            var result = await _browser.ExecuteAsync(sessionId, ownerId, lease.Epoch, action, artifact, cancellationToken);
            var madeProgress = result.Outcome is BrowserActionOutcome.Succeeded or BrowserActionOutcome.NavigationStarted;
            if (madeProgress && action.Handle is { } completedControl && _answers is ISensitiveAnswerApprovalCoordinator sensitiveAnswers)
            {
                sensitiveAnswers.MarkUsed(run.Id, completedControl);
            }
            if (madeProgress && action.Handle == userAnswer?.ControlId)
            {
                _userAnswers.Remove(run.Id);
            }
            run.RecordAction(madeProgress, madeProgress);
            await CheckpointAsync(run, action.Kind.ToString(), action.Handle ?? action.TargetUri?.Host ?? run.PageStage,
                result.Code, ControlOwner.Agent, cancellationToken);

            if (result.Outcome == BrowserActionOutcome.UserInterrupted)
            {
                if (run.State != RunState.UserControl)
                    Transition(run, RunState.UserControl, RunActor.User, "User took control");
                return new OrchestrationYield(run.State, result.Code, result.Message, observation);
            }

            if (result.Outcome == BrowserActionOutcome.Blocked)
            {
                Transition(run, RunState.AwaitingUser, RunActor.System, result.Code);
                return new OrchestrationYield(run.State, result.Code, result.Message, observation);
            }

            if (result.Outcome == BrowserActionOutcome.BrowserError)
            {
                Transition(run, RunState.Failed, RunActor.System, result.Code);
                await CheckpointAsync(run, "Browser stopped", run.PageStage, result.Code, ControlOwner.Agent, cancellationToken);
                return new OrchestrationYield(
                    run.State,
                    result.Code,
                    $"{result.Message} Recover this application from its last saved step.",
                    observation);
            }

            Transition(run, result.Outcome == BrowserActionOutcome.NavigationStarted ? RunState.Navigating : RunState.Observing,
                RunActor.System, result.Code);
            if (run.State == RunState.Navigating)
                Transition(run, RunState.Observing, RunActor.System, "Navigation settled; refreshing observation");
        }

        throw new OperationCanceledException(cancellationToken);
    }

    public async Task<OrchestrationYield> SubmitAsync(
        ApplicationRun run,
        Guid sessionId,
        string ownerId,
        IReadOnlySet<string> approvedDomains,
        BrowserAction submitAction,
        CancellationToken cancellationToken)
    {
        if (!run.SubmissionApproved) throw new InvalidOperationException("Final submission is not approved.");
        var observation = await _browser.ObserveAsync(sessionId, ownerId, cancellationToken);
        var lease = _leases.Get(sessionId);
        var decision = _policy.Validate(submitAction, observation, new DomainGraph(approvedDomains), lease.Owner,
            finalSubmissionApproved: true);
        if (!decision.Allowed) return new OrchestrationYield(run.State, decision.Code, decision.Message, observation);

        Transition(run, RunState.Submitting, RunActor.User, "Submitting the approved application");
        // Persist the irreversible-attempt marker before interacting with the website.
        // Recovery therefore fails closed if the worker exits during submission.
        await CheckpointAsync(run, "Submit application", run.PageStage, "submission-started", ControlOwner.User, cancellationToken);
        var result = await _browser.ExecuteAsync(sessionId, ownerId, lease.Epoch, submitAction, null, cancellationToken);
        await CheckpointAsync(run, "Submit application", run.PageStage, result.Code, ControlOwner.User, cancellationToken);
        if (result.Outcome is BrowserActionOutcome.Succeeded or BrowserActionOutcome.NavigationStarted)
        {
            Transition(run, RunState.Completed, RunActor.System, "Submission action verified");
            await CheckpointAsync(run, "Confirm completion", run.PageStage, "submitted", ControlOwner.User, cancellationToken);
            return new OrchestrationYield(run.State, "submitted", "The approved application was submitted.");
        }

        Transition(run, RunState.ReviewReady, RunActor.System, "Submission result was not verified");
        await CheckpointAsync(run, "Final review", run.PageStage, "submission-not-verified", ControlOwner.User, cancellationToken);
        return new OrchestrationYield(run.State, "submission-not-verified", "Submission was not retried because the outcome is uncertain.", observation);
    }

    private async Task CheckpointAsync(ApplicationRun run, string intent, string target, string result, ControlOwner actor, CancellationToken cancellationToken)
    {
        var latest = await _checkpoints.GetLatestAsync(run.Id, cancellationToken);
        await _checkpoints.AppendAsync(new Checkpoint(Guid.NewGuid(), run.Id, (latest?.Sequence ?? 0) + 1, run.State,
            run.PageStage, run.CurrentUri, run.PageGeneration, intent, target, result, actor, _timeProvider.GetUtcNow(),
            run.SubmissionApproved, run.SubmissionAttempted), cancellationToken);
    }

    private void Transition(ApplicationRun run, RunState state, RunActor actor, string reason) =>
        run.Transition(state, actor, reason, _timeProvider.GetUtcNow(), run.Version);

    private static bool IsApprovedSensitiveAction(
        BrowserAction action,
        PageObservation observation,
        IReadOnlyList<RelevantAnswer> answers)
    {
        if (action.Handle is null)
        {
            return false;
        }

        var control = observation.Controls.FirstOrDefault(value => value.Handle == action.Handle);
        if (control is null || !control.Sensitive)
        {
            return false;
        }

        static string Normalize(string? value) => new((value ?? string.Empty)
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray());
        var label = Normalize(control.Label);
        return answers.Any(answer =>
            answer.Sensitive &&
            answer.ApprovedForThisApplication &&
            Normalize(answer.Field) == label);
    }

    private static string DescribeStage(PageObservation observation) => observation.Kind switch
    {
        PageKind.ApplicationStep => observation.Title.Length > 0 ? observation.Title : "Application step",
        PageKind.Review => "Final review",
        PageKind.Confirmation => "Confirmation",
        PageKind.Login => "Sign in",
        PageKind.Mfa => "Identity verification",
        PageKind.Captcha => "Human verification",
        _ => observation.Kind.ToString()
    };

    private static string BuildUserQuestion(PageObservation observation) => observation.Kind switch
    {
        PageKind.Login => "Please sign in to this application, then choose Resume.",
        PageKind.Mfa => "Please complete the identity check, then choose Resume.",
        PageKind.Captcha => "Please complete the human check, then choose Resume.",
        _ => "Please review this sensitive or legal question, then choose Resume."
    };

    private static ImmutableArray<string> VisibleOptions(PageObservation observation) => observation.Controls
        .Where(control => control.Required && control.Options.Length > 0)
        .SelectMany(control => control.Options)
        .Distinct(StringComparer.Ordinal)
        .Take(30)
        .ToImmutableArray();
}

public sealed class NullApplicationPlanner : IApplicationPlanner
{
    public Task<PlannerDecision> PlanAsync(PlanningContext context, CancellationToken cancellationToken) =>
        Task.FromResult(new PlannerDecision(PlannerDecisionKind.Unsupported, Reason: "No compatible planner is configured."));
}

public sealed class EmptyRelevantAnswerSource : IRelevantAnswerSource
{
    public Task<RelevantAnswerLookup> GetForVisibleControlsAsync(
        Guid runId,
        Guid profileId,
        IReadOnlyList<VisibleControl> controls,
        CancellationToken cancellationToken) =>
        Task.FromResult(new RelevantAnswerLookup([]));
}
