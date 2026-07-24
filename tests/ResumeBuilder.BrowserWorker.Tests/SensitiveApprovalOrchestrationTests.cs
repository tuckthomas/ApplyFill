using System.Collections.Immutable;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Security;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class SensitiveApprovalOrchestrationTests
{
    private const string SensitiveValue = "123456789";

    [Fact]
    public async Task SavedSensitiveAnswerOffersMaskedApprovalBeforeGenericHandoff()
    {
        var approval = new SensitiveAnswerApprovalPrompt(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "ssn",
            "Social Security number",
            "Social Security number",
            "••••6789");
        var answers = new StubAnswerSource(new RelevantAnswerLookup([], approval));
        var checkpoints = new InMemoryRunCheckpointStore();
        var planner = new RejectingPlanner();
        var runtime = new SensitiveRuntime();
        var orchestrator = CreateOrchestrator(runtime, answers, checkpoints, planner);
        var run = CreateRun();

        var (_, result) = await orchestrator.StartAsync(
            run,
            CreateSessionStart(),
            TestContext.Current.CancellationToken);

        Assert.Equal("sensitive-approval-required", result.Code);
        Assert.Equal(approval.ApprovalId, result.SensitiveApproval?.ApprovalId);
        Assert.Contains("••••6789", result.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(SensitiveValue, result.Message, StringComparison.Ordinal);
        Assert.Equal(1, answers.CallCount);
        Assert.Equal(0, planner.CallCount);
        Assert.Equal(0, runtime.ExecuteCount);
        Assert.DoesNotContain(
            await checkpoints.GetActivityAsync(run.Id, TestContext.Current.CancellationToken),
            checkpoint => ContainsSensitiveValue(checkpoint));
    }

    [Fact]
    public async Task ApprovedSensitiveAnswerIsUsedOnceWithoutEnteringModelOrCheckpoint()
    {
        var approved = new RelevantAnswer(
            "Social Security number",
            SensitiveValue,
            Sensitive: true,
            ApprovedForThisApplication: true);
        var answers = new StubAnswerSource(new RelevantAnswerLookup([approved]));
        var checkpoints = new InMemoryRunCheckpointStore();
        var planner = new RejectingPlanner();
        var runtime = new SensitiveRuntime(markFilledAfterExecution: true);
        var run = CreateRun();
        var orchestrator = CreateOrchestrator(runtime, answers, checkpoints, planner);

        var (_, result) = await orchestrator.StartAsync(
            run,
            CreateSessionStart(),
            TestContext.Current.CancellationToken);

        Assert.Equal("review-ready", result.Code);
        Assert.Equal(1, runtime.ExecuteCount);
        Assert.Equal(SensitiveValue, runtime.LastTypedValue);
        Assert.Equal(0, planner.CallCount);
        var activity = await checkpoints.GetActivityAsync(run.Id, TestContext.Current.CancellationToken);
        Assert.DoesNotContain(activity, ContainsSensitiveValue);
    }

    [Fact]
    public async Task BrowserFailureCodeReachesRecoverableRunState()
    {
        var approved = new RelevantAnswer(
            "Social Security number",
            SensitiveValue,
            Sensitive: true,
            ApprovedForThisApplication: true);
        var runtime = new SensitiveRuntime(actionOutcome: BrowserActionOutcome.BrowserError);
        var orchestrator = CreateOrchestrator(
            runtime,
            new StubAnswerSource(new RelevantAnswerLookup([approved])),
            new InMemoryRunCheckpointStore(),
            new RejectingPlanner());

        var (_, result) = await orchestrator.StartAsync(
            CreateRun(),
            CreateSessionStart(),
            TestContext.Current.CancellationToken);

        Assert.Equal(RunState.Failed, result.State);
        Assert.Equal("browser-crashed", result.Code);
        Assert.Contains("Recover", result.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("denied")]
    [InlineData("unavailable")]
    public async Task DeniedOrUnavailableSensitiveAnswerFallsBackToUserControl(string reason)
    {
        var answers = new StubAnswerSource(new RelevantAnswerLookup([]), reason);
        var planner = new RejectingPlanner();
        var runtime = new SensitiveRuntime();
        var orchestrator = CreateOrchestrator(
            runtime,
            answers,
            new InMemoryRunCheckpointStore(),
            planner);

        var (_, result) = await orchestrator.StartAsync(
            CreateRun(),
            CreateSessionStart(),
            TestContext.Current.CancellationToken);

        Assert.Equal("user-input-required", result.Code);
        Assert.Equal(RunState.AwaitingUser, result.State);
        Assert.Equal(1, answers.CallCount);
        Assert.Equal(0, planner.CallCount);
        Assert.Equal(0, runtime.ExecuteCount);
    }

    [Theory]
    [InlineData(PageKind.Login, "Password", "password", 1)]
    [InlineData(PageKind.Mfa, "Verification code", "text", 0)]
    [InlineData(PageKind.Captcha, "Human verification", "checkbox", 0)]
    [InlineData(PageKind.ApplicationStep, "I certify this application is accurate", "checkbox", 0)]
    public async Task CredentialCaptchaAndLegalGatesRemainImmediateHandoffs(
        PageKind kind,
        string label,
        string type,
        int answerLookups)
    {
        var answers = new StubAnswerSource(new RelevantAnswerLookup([]));
        var runtime = new SensitiveRuntime(kind, label, type);
        var orchestrator = CreateOrchestrator(
            runtime,
            answers,
            new InMemoryRunCheckpointStore(),
            new RejectingPlanner());

        var (_, result) = await orchestrator.StartAsync(
            CreateRun(),
            CreateSessionStart(),
            TestContext.Current.CancellationToken);

        Assert.Equal("user-input-required", result.Code);
        Assert.Equal(answerLookups, answers.CallCount);
    }

    private static ApplicationRunOrchestrator CreateOrchestrator(
        IManagedBrowserRuntime runtime,
        IRelevantAnswerSource answers,
        IRunCheckpointStore checkpoints,
        IApplicationPlanner planner)
    {
        var leases = new ControlLeaseManager();
        return new ApplicationRunOrchestrator(
            runtime,
            checkpoints,
            planner,
            answers,
            new InMemoryUserAnswerInbox(),
            new MissingArtifactStore(),
            new DeterministicActionResolver(),
            new BrowserActionPolicy(),
            leases);
    }

    private static ApplicationRun CreateRun() => new(
        Guid.NewGuid(),
        "local-user",
        "Complete the application through final review.",
        new Uri("https://jobs.example.test/apply"),
        Guid.NewGuid(),
        Guid.NewGuid(),
        DateTimeOffset.UtcNow);

    private static BrowserSessionStart CreateSessionStart() => new(
        new Uri("https://jobs.example.test/apply"),
        "local-user",
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "jobs.example.test" });

    private static bool ContainsSensitiveValue(Checkpoint checkpoint) =>
        checkpoint.Intent.Contains(SensitiveValue, StringComparison.Ordinal) ||
        checkpoint.Target.Contains(SensitiveValue, StringComparison.Ordinal) ||
        checkpoint.Result.Contains(SensitiveValue, StringComparison.Ordinal);

    private sealed class StubAnswerSource(RelevantAnswerLookup lookup, string? state = null) : IRelevantAnswerSource
    {
        public int CallCount { get; private set; }

        public Task<RelevantAnswerLookup> GetForVisibleControlsAsync(
            Guid runId,
            Guid profileId,
            IReadOnlyList<VisibleControl> controls,
            CancellationToken cancellationToken)
        {
            CallCount++;
            _ = state;
            return Task.FromResult(lookup);
        }
    }

    private sealed class RejectingPlanner : IApplicationPlanner
    {
        public int CallCount { get; private set; }

        public Task<PlannerDecision> PlanAsync(PlanningContext context, CancellationToken cancellationToken)
        {
            CallCount++;
            throw new Xunit.Sdk.XunitException("Sensitive plaintext must not reach the model planner.");
        }
    }

    private sealed class MissingArtifactStore : IApprovedArtifactStore
    {
        public Task<ApprovedArtifact?> GetLatestForRunAsync(Guid runId, Guid resumeId, CancellationToken cancellationToken) =>
            Task.FromResult<ApprovedArtifact?>(null);

        public Task<ApprovedArtifact?> GetVerifiedAsync(Guid artifactId, Guid runId, CancellationToken cancellationToken) =>
            Task.FromResult<ApprovedArtifact?>(null);

        public Task ReleaseRunAsync(Guid runId, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class SensitiveRuntime : IManagedBrowserRuntime
    {
        private readonly Guid _sessionId = Guid.NewGuid();
        private readonly PageKind _initialKind;
        private readonly string _label;
        private readonly string _type;
        private readonly bool _markFilledAfterExecution;
        private readonly BrowserActionOutcome _actionOutcome;
        private bool _filled;

        public SensitiveRuntime(
            PageKind initialKind = PageKind.ApplicationStep,
            string label = "Social Security number",
            string type = "text",
            bool markFilledAfterExecution = false,
            BrowserActionOutcome actionOutcome = BrowserActionOutcome.Succeeded)
        {
            _initialKind = initialKind;
            _label = label;
            _type = type;
            _markFilledAfterExecution = markFilledAfterExecution;
            _actionOutcome = actionOutcome;
        }

        public int ExecuteCount { get; private set; }
        public string? LastTypedValue { get; private set; }

        public Task<BrowserSessionDescriptor> StartAsync(
            Guid runId,
            BrowserSessionStart request,
            CancellationToken cancellationToken) => Task.FromResult(new BrowserSessionDescriptor(
                _sessionId,
                runId,
                request.OwnerId,
                request.StartUri,
                1,
                ControlOwner.None,
                DateTimeOffset.UtcNow,
                true));

        public Task<BrowserSessionDescriptor?> GetAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken) =>
            Task.FromResult<BrowserSessionDescriptor?>(null);

        public Task<PageObservation> ObserveAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken)
        {
            var kind = _filled ? PageKind.Review : _initialKind;
            var currentValue = _filled ? "[protected]" : null;
            var control = new VisibleControl(
                "ssn",
                _type is "checkbox" ? "checkbox" : "textbox",
                _label,
                _type,
                Required: true,
                Enabled: true,
                Checked: _filled && _type == "checkbox",
                Sensitive: _type == "password" || _label.Contains("Social Security", StringComparison.OrdinalIgnoreCase) ||
                           _label.Contains("Verification", StringComparison.OrdinalIgnoreCase),
                CurrentValue: currentValue,
                Options: ImmutableArray<string>.Empty);
            return Task.FromResult(new PageObservation(
                1,
                _sessionId,
                1,
                new Uri("https://jobs.example.test/apply"),
                "Application",
                kind,
                [control],
                [],
                [1, 2, 3],
                DateTimeOffset.UtcNow));
        }

        public Task<BrowserActionResult> ExecuteAsync(
            Guid sessionId,
            string ownerId,
            long controlEpoch,
            BrowserAction action,
            ApprovedArtifact? artifact,
            CancellationToken cancellationToken)
        {
            ExecuteCount++;
            LastTypedValue = action.Value;
            _filled = _markFilledAfterExecution;
            return Task.FromResult(new BrowserActionResult(
                _actionOutcome,
                _actionOutcome == BrowserActionOutcome.BrowserError ? "browser-crashed" : "verified",
                _actionOutcome == BrowserActionOutcome.BrowserError
                    ? "The managed browser stopped unexpectedly."
                    : "The protected field was populated.",
                1,
                true,
                DateTimeOffset.UtcNow));
        }

        public Task<ViewportFrame> CaptureFrameAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task RelayInputAsync(Guid sessionId, string ownerId, long controlEpoch, BrowserInput input, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task StopAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken) => Task.CompletedTask;

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
