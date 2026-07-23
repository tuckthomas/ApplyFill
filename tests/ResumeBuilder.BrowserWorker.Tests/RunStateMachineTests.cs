using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class RunStateMachineTests
{
    [Fact]
    public void NewRunHasCompleteObjectiveIdentity()
    {
        var run = CreateRun();

        Assert.Equal(RunState.Created, run.State);
        Assert.Equal("Complete the Acme application", run.Objective);
        Assert.NotEqual(Guid.Empty, run.ProfileId);
        Assert.NotEqual(Guid.Empty, run.ResumeArtifactId);
    }

    [Theory]
    [InlineData(RunState.Created, RunState.StartingBrowser, true)]
    [InlineData(RunState.Created, RunState.Completed, false)]
    [InlineData(RunState.AgentRunning, RunState.UserControl, true)]
    [InlineData(RunState.ReviewReady, RunState.Submitting, true)]
    [InlineData(RunState.Completed, RunState.Recovering, false)]
    [InlineData(RunState.Failed, RunState.Recovering, true)]
    public void TransitionGraphIsExplicit(RunState from, RunState to, bool expected) =>
        Assert.Equal(expected, ApplicationRun.IsTransitionAllowed(from, to));

    [Fact]
    public void ConcurrencyTokenRejectsStaleCommand()
    {
        var run = CreateRun();
        run.Transition(RunState.StartingBrowser, RunActor.System, "start", DateTimeOffset.UtcNow, 0);

        Assert.Throws<RunConcurrencyException>(() =>
            run.Transition(RunState.Navigating, RunActor.System, "navigate", DateTimeOffset.UtcNow, 0));
    }

    [Fact]
    public void AgentCannotApproveOrSubmitApplication()
    {
        var run = MoveToReview();

        Assert.Throws<UnauthorizedAccessException>(() =>
            run.ApproveSubmission(RunActor.Agent, DateTimeOffset.UtcNow, run.Version));
        Assert.Throws<InvalidOperationException>(() =>
            run.Transition(RunState.Submitting, RunActor.User, "submit", DateTimeOffset.UtcNow, run.Version));
    }

    [Fact]
    public void SubmissionIsSingleAttemptAndAuditable()
    {
        var run = MoveToReview();
        run.ApproveSubmission(RunActor.User, DateTimeOffset.UtcNow, run.Version);
        run.Transition(RunState.Submitting, RunActor.User, "submit", DateTimeOffset.UtcNow, run.Version);
        run.Transition(RunState.ReviewReady, RunActor.System, "uncertain", DateTimeOffset.UtcNow, run.Version);

        Assert.True(run.SubmissionAttempted);
        Assert.Throws<InvalidOperationException>(() =>
            run.Transition(RunState.Submitting, RunActor.User, "retry", DateTimeOffset.UtcNow, run.Version));
        Assert.Contains(run.History, transition => transition.Reason == "Final submission approved");
    }

    [Fact]
    public void RecoveredSubmissionAttemptCannotBeApprovedAgain()
    {
        var run = new ApplicationRun(
            Guid.NewGuid(),
            "owner",
            "Continue the application",
            new Uri("https://jobs.example.com/apply"),
            Guid.NewGuid(),
            Guid.NewGuid(),
            DateTimeOffset.UtcNow,
            submissionAttempted: true);
        Move(run, RunState.StartingBrowser);
        Move(run, RunState.Navigating);
        Move(run, RunState.Observing);
        Move(run, RunState.ReviewReady);

        var failure = Assert.Throws<InvalidOperationException>(() =>
            run.ApproveSubmission(RunActor.User, DateTimeOffset.UtcNow, run.Version));

        Assert.Contains("will not submit", failure.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ProgressLimitsStopOscillation()
    {
        var run = CreateRun(new RunLimits(MaxActions: 20, MaxModelCalls: 20, MaxConsecutiveFailures: 2, MaxNoProgressCycles: 2));
        run.RecordAction(false, false);
        run.RecordAction(false, false);

        Assert.Equal("repeated-failure-limit", run.GetLimitViolation(DateTimeOffset.UtcNow));
    }

    private static ApplicationRun MoveToReview()
    {
        var run = CreateRun();
        Move(run, RunState.StartingBrowser);
        Move(run, RunState.Navigating);
        Move(run, RunState.Observing);
        Move(run, RunState.ReviewReady);
        return run;
    }

    private static void Move(ApplicationRun run, RunState state) =>
        run.Transition(state, RunActor.System, state.ToString(), DateTimeOffset.UtcNow, run.Version);

    private static ApplicationRun CreateRun(RunLimits? limits = null) =>
        new(Guid.NewGuid(), "owner", "Complete the Acme application", new Uri("https://jobs.example.com/apply"),
            Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UtcNow, limits);
}
