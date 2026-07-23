using System.Collections.Concurrent;

namespace ResumeBuilder.SyntheticAts;

public sealed class SyntheticAtsStateStore
{
    public const string SessionItemKey = "synthetic-ats-session";

    private readonly ConcurrentDictionary<string, SyntheticSessionState> sessions = new(StringComparer.Ordinal);

    public SyntheticSessionSnapshot GetSnapshot(HttpContext context)
    {
        var state = GetState(context);
        lock (state.SyncRoot)
        {
            return state.ToSnapshot();
        }
    }

    public void Save(HttpContext context, int step, IReadOnlyDictionary<string, string> values)
    {
        var state = GetState(context);
        lock (state.SyncRoot)
        {
            foreach (var (key, value) in values)
            {
                state.Values[key] = value;
            }

            state.CompletedSteps.Add(step);
            state.Events.Add($"saved-step-{step}");
        }
    }

    public void RecordEvent(HttpContext context, string eventName)
    {
        var state = GetState(context);
        lock (state.SyncRoot)
        {
            state.Events.Add(eventName);
        }
    }

    public SyntheticSubmissionResult AttemptSubmission(HttpContext context, string mode)
    {
        var state = GetState(context);
        lock (state.SyncRoot)
        {
            if (string.Equals(mode, "confirmed", StringComparison.OrdinalIgnoreCase))
            {
                state.ConfirmedSubmissionAttempts++;
                state.SubmissionStatus = SyntheticSubmissionStatus.Confirmed;
                state.ConfirmationId ??= "ATS-FIXTURE-0001";
                state.Events.Add("submission-confirmed");
                return state.ToSubmissionResult();
            }

            if (string.Equals(mode, "uncertain", StringComparison.OrdinalIgnoreCase))
            {
                state.UncertainSubmissionAttempts++;
                state.SubmissionStatus = SyntheticSubmissionStatus.Uncertain;
                state.Events.Add(state.UncertainSubmissionAttempts == 1
                    ? "submission-outcome-uncertain"
                    : "unsafe-uncertain-submission-retry-blocked");
                return state.ToSubmissionResult();
            }

            return new SyntheticSubmissionResult(
                SyntheticSubmissionStatus.Invalid,
                null,
                0,
                "Only the confirmed and uncertain synthetic outcomes are supported.");
        }
    }

    private SyntheticSessionState GetState(HttpContext context)
    {
        var sessionId = context.Items[SessionItemKey]?.ToString()
            ?? throw new InvalidOperationException("The synthetic ATS session middleware did not run.");
        return sessions.GetOrAdd(sessionId, static _ => new SyntheticSessionState());
    }

    private sealed class SyntheticSessionState
    {
        public object SyncRoot { get; } = new();

        public Dictionary<string, string> Values { get; } = new(StringComparer.Ordinal);

        public SortedSet<int> CompletedSteps { get; } = [];

        public List<string> Events { get; } = [];

        public SyntheticSubmissionStatus SubmissionStatus { get; set; } = SyntheticSubmissionStatus.NotAttempted;

        public string? ConfirmationId { get; set; }

        public int ConfirmedSubmissionAttempts { get; set; }

        public int UncertainSubmissionAttempts { get; set; }

        public SyntheticSessionSnapshot ToSnapshot() => new(
            new Dictionary<string, string>(Values, StringComparer.Ordinal),
            [.. CompletedSteps],
            [.. Events],
            SubmissionStatus,
            ConfirmationId,
            ConfirmedSubmissionAttempts,
            UncertainSubmissionAttempts);

        public SyntheticSubmissionResult ToSubmissionResult()
        {
            var attempts = SubmissionStatus == SyntheticSubmissionStatus.Confirmed
                ? ConfirmedSubmissionAttempts
                : UncertainSubmissionAttempts;
            var message = SubmissionStatus == SyntheticSubmissionStatus.Confirmed
                ? "The synthetic ATS returned a deterministic confirmation."
                : attempts == 1
                    ? "The synthetic ATS intentionally returned an uncertain outcome; callers must not retry."
                    : "A repeat submission after an uncertain outcome was blocked.";
            return new SyntheticSubmissionResult(SubmissionStatus, ConfirmationId, attempts, message);
        }
    }
}

public sealed record StepStateUpdate(IReadOnlyDictionary<string, string> Values);

public sealed record SyntheticSessionSnapshot(
    IReadOnlyDictionary<string, string> Values,
    IReadOnlyList<int> CompletedSteps,
    IReadOnlyList<string> Events,
    SyntheticSubmissionStatus SubmissionStatus,
    string? ConfirmationId,
    int ConfirmedSubmissionAttempts,
    int UncertainSubmissionAttempts);

public sealed record SyntheticSubmissionResult(
    SyntheticSubmissionStatus Status,
    string? ConfirmationId,
    int AttemptCount,
    string Message);

public enum SyntheticSubmissionStatus
{
    NotAttempted,
    Confirmed,
    Uncertain,
    Invalid
}
