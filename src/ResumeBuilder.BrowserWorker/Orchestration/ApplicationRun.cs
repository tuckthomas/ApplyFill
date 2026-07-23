using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public enum RunActor
{
    System,
    Agent,
    User
}

public sealed record RunTransition(
    RunState From,
    RunState To,
    RunActor Actor,
    string Reason,
    DateTimeOffset OccurredAt,
    long Version);

public sealed class InvalidRunTransitionException(RunState from, RunState to, RunActor actor)
    : InvalidOperationException($"Transition from {from} to {to} is not permitted for {actor}.")
{
    public RunState From { get; } = from;
    public RunState To { get; } = to;
    public RunActor Actor { get; } = actor;
}

public sealed class RunConcurrencyException(long expected, long actual)
    : InvalidOperationException($"Run version mismatch. Expected {expected}, actual {actual}.");

public sealed class ApplicationRun
{
    private static readonly Dictionary<RunState, IReadOnlySet<RunState>> LegalTransitions =
        new Dictionary<RunState, IReadOnlySet<RunState>>
        {
            [RunState.Created] = States(RunState.StartingBrowser, RunState.Stopped),
            [RunState.StartingBrowser] = States(RunState.Navigating, RunState.Pausing, RunState.UserControl, RunState.Recovering, RunState.Failed, RunState.Stopped),
            [RunState.Navigating] = States(RunState.Observing, RunState.AwaitingUser, RunState.Pausing, RunState.UserControl, RunState.Recovering, RunState.Failed, RunState.Stopped),
            [RunState.Observing] = States(RunState.Planning, RunState.AwaitingUser, RunState.ReviewReady, RunState.Completed, RunState.Pausing, RunState.UserControl, RunState.Recovering, RunState.Failed, RunState.Stopped),
            [RunState.Planning] = States(RunState.AgentRunning, RunState.AwaitingUser, RunState.Pausing, RunState.UserControl, RunState.Failed, RunState.Stopped),
            [RunState.AgentRunning] = States(RunState.Observing, RunState.Navigating, RunState.Pausing, RunState.UserControl, RunState.AwaitingUser, RunState.ReviewReady, RunState.Recovering, RunState.Failed, RunState.Stopped),
            [RunState.Pausing] = States(RunState.Paused, RunState.Stopped),
            [RunState.Paused] = States(RunState.AgentRunning, RunState.UserControl, RunState.Recovering, RunState.Stopped),
            [RunState.UserControl] = States(RunState.Observing, RunState.Pausing, RunState.Paused, RunState.Recovering, RunState.Stopped),
            [RunState.AwaitingUser] = States(RunState.Observing, RunState.Pausing, RunState.UserControl, RunState.Failed, RunState.Stopped),
            [RunState.Recovering] = States(RunState.StartingBrowser, RunState.Observing, RunState.Pausing, RunState.AwaitingUser, RunState.Failed, RunState.Stopped),
            [RunState.ReviewReady] = States(RunState.Submitting, RunState.Pausing, RunState.UserControl, RunState.AgentRunning, RunState.Stopped),
            [RunState.Submitting] = States(RunState.Completed, RunState.ReviewReady, RunState.AwaitingUser, RunState.Failed, RunState.Stopped),
            [RunState.Completed] = States(),
            [RunState.Stopped] = States(),
            [RunState.Failed] = States(RunState.Recovering, RunState.Stopped)
        };

    private readonly object _gate = new();
    private readonly List<RunTransition> _history = [];

    public ApplicationRun(
        Guid id,
        string ownerId,
        string objective,
        Uri jobUri,
        Guid profileId,
        Guid resumeArtifactId,
        DateTimeOffset createdAt,
        RunLimits? limits = null,
        Guid? jobApplicationId = null,
        bool submissionAttempted = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerId);
        ArgumentException.ThrowIfNullOrWhiteSpace(objective);
        ArgumentNullException.ThrowIfNull(jobUri);

        Id = id;
        OwnerId = ownerId;
        Objective = objective;
        JobUri = jobUri;
        ProfileId = profileId;
        ResumeArtifactId = resumeArtifactId;
        JobApplicationId = jobApplicationId;
        CreatedAt = createdAt;
        Limits = limits ?? new RunLimits();
        State = RunState.Created;
        SubmissionAttempted = submissionAttempted;
    }

    public Guid Id { get; }
    public string OwnerId { get; }
    public string Objective { get; }
    public Uri JobUri { get; }
    public Guid ProfileId { get; }
    public Guid ResumeArtifactId { get; private set; }
    public Guid? JobApplicationId { get; }
    public RunState State { get; private set; }
    public RunLimits Limits { get; }
    public string PageStage { get; private set; } = "Not started";
    public long PageGeneration { get; private set; }
    public Uri? CurrentUri { get; private set; }
    public int ActionCount { get; private set; }
    public int ModelCallCount { get; private set; }
    public int ConsecutiveFailures { get; private set; }
    public int NoProgressCycles { get; private set; }
    public bool SubmissionApproved { get; private set; }
    public bool SubmissionAttempted { get; private set; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public long Version { get; private set; }
    public IReadOnlyList<RunTransition> History => _history.AsReadOnly();

    public static bool IsTransitionAllowed(RunState from, RunState to) =>
        LegalTransitions.TryGetValue(from, out var targets) && targets.Contains(to);

    public void Transition(RunState next, RunActor actor, string reason, DateTimeOffset now, long expectedVersion)
    {
        lock (_gate)
        {
            if (expectedVersion != Version)
            {
                throw new RunConcurrencyException(expectedVersion, Version);
            }

            if (!IsTransitionAllowed(State, next) || !ActorMayTransition(actor, next))
            {
                throw new InvalidRunTransitionException(State, next, actor);
            }

            if (next == RunState.Submitting && !SubmissionApproved)
            {
                throw new InvalidOperationException("Final submission requires explicit approval.");
            }

            if (next == RunState.Submitting && SubmissionAttempted)
            {
                throw new InvalidOperationException("A submission has already been attempted for this run.");
            }

            var previous = State;
            State = next;
            Version++;
            if (next == RunState.Submitting)
            {
                SubmissionAttempted = true;
            }

            if (next is RunState.Completed or RunState.Stopped)
            {
                CompletedAt = now;
            }

            _history.Add(new RunTransition(previous, next, actor, reason, now, Version));
        }
    }

    public void ApproveSubmission(RunActor actor, DateTimeOffset now, long expectedVersion)
    {
        lock (_gate)
        {
            if (actor != RunActor.User)
            {
                throw new UnauthorizedAccessException("Only the user can approve final submission.");
            }

            if (expectedVersion != Version)
            {
                throw new RunConcurrencyException(expectedVersion, Version);
            }

            if (State != RunState.ReviewReady)
            {
                throw new InvalidOperationException("Submission can only be approved from final review.");
            }

            if (SubmissionAttempted)
            {
                throw new InvalidOperationException("ApplyFill will not submit an application twice after recovery.");
            }

            SubmissionApproved = true;
            Version++;
            _history.Add(new RunTransition(State, State, actor, "Final submission approved", now, Version));
        }
    }

    public void RecordObservation(Uri uri, long pageGeneration, string pageStage)
    {
        ArgumentNullException.ThrowIfNull(uri);
        ArgumentException.ThrowIfNullOrWhiteSpace(pageStage);
        lock (_gate)
        {
            CurrentUri = uri;
            PageGeneration = pageGeneration;
            PageStage = pageStage;
        }
    }

    public void RecordAction(bool succeeded, bool madeProgress)
    {
        lock (_gate)
        {
            ActionCount++;
            ConsecutiveFailures = succeeded ? 0 : ConsecutiveFailures + 1;
            NoProgressCycles = madeProgress ? 0 : NoProgressCycles + 1;
        }
    }

    public void RecordModelCall()
    {
        lock (_gate) ModelCallCount++;
    }

    public string? GetLimitViolation(DateTimeOffset now)
    {
        if (ActionCount >= Limits.MaxActions) return "action-limit";
        if (ModelCallCount >= Limits.MaxModelCalls) return "model-call-limit";
        if (ConsecutiveFailures >= Limits.MaxConsecutiveFailures) return "repeated-failure-limit";
        if (NoProgressCycles >= Limits.MaxNoProgressCycles) return "no-progress-limit";
        if (now - CreatedAt >= Limits.EffectiveMaxElapsed) return "elapsed-time-limit";
        return null;
    }

    private static HashSet<RunState> States(params RunState[] values) => [.. values];

    private static bool ActorMayTransition(RunActor actor, RunState next) => actor switch
    {
        RunActor.System => true,
        RunActor.User => next is RunState.UserControl or RunState.Pausing or RunState.Paused or RunState.Stopped or RunState.Submitting or RunState.Observing,
        RunActor.Agent => next is not (RunState.UserControl or RunState.Submitting or RunState.Completed),
        _ => false
    };
}
