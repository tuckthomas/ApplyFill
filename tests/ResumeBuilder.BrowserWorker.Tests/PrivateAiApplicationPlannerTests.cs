using System.Collections.Immutable;
using ResumeBuilder.Application.Models;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.PrivateAi;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class PrivateAiApplicationPlannerTests
{
    [Fact]
    public async Task ValidCurrentHandleBecomesOneBoundedAction()
    {
        const string output = """
            {"decision":"action","action":{"kind":"type","handle":"g1-f0-c0","value":"Ada","expectedResult":"The first-name field contains Ada."},"question":null,"visibleOptions":null,"reason":"Required answer is available."}
            """;
        var planner = new PrivateAiApplicationPlanner(new FakePrivateAi(output));

        var decision = await planner.PlanAsync(Context(), TestContext.Current.CancellationToken);

        Assert.Equal(PlannerDecisionKind.Action, decision.Kind);
        Assert.Equal(BrowserActionKind.Type, decision.Action?.Kind);
        Assert.Equal("g1-f0-c0", decision.Action?.Handle);
        Assert.Equal("Ada", decision.Action?.Value);
        Assert.Equal(7, decision.Action?.PageGeneration);
    }

    [Fact]
    public async Task UnknownHandleFailsClosedAfterCompactRetry()
    {
        const string output = """
            {"decision":"action","action":{"kind":"click","handle":"invented","expectedResult":"Continue."},"question":null,"visibleOptions":null,"reason":null}
            """;
        var fake = new FakePrivateAi(output);
        var planner = new PrivateAiApplicationPlanner(fake);

        var decision = await planner.PlanAsync(Context(), TestContext.Current.CancellationToken);

        Assert.Equal(PlannerDecisionKind.Unsupported, decision.Kind);
        Assert.Equal(2, fake.CallCount);
    }

    [Fact]
    public async Task SensitiveControlCannotBeChangedByModel()
    {
        const string output = """
            {"decision":"action","action":{"kind":"type","handle":"g1-f0-c1","value":"123-45-6789","expectedResult":"Identifier entered."},"question":null,"visibleOptions":null,"reason":null}
            """;
        var planner = new PrivateAiApplicationPlanner(new FakePrivateAi(output));

        var decision = await planner.PlanAsync(Context(), TestContext.Current.CancellationToken);

        Assert.Equal(PlannerDecisionKind.Unsupported, decision.Kind);
    }

    [Fact]
    public async Task ApprovedSensitiveAnswerNeverEntersTheModelContext()
    {
        const string output = """
            {"decision":"ask-user","action":null,"question":"Please take control.","visibleOptions":null,"reason":"A manual answer is required."}
            """;
        var fake = new FakePrivateAi(output);
        var planner = new PrivateAiApplicationPlanner(fake);
        var context = Context() with
        {
            RelevantAnswers =
            [
                new RelevantAnswer("First name", "Ada", false, true),
                new RelevantAnswer("Social Security number", "123456789", true, true),
            ],
        };

        await planner.PlanAsync(context, TestContext.Current.CancellationToken);

        Assert.NotNull(fake.LastRequest?.ContextJson);
        Assert.Contains("Ada", fake.LastRequest.ContextJson, StringComparison.Ordinal);
        Assert.DoesNotContain("123456789", fake.LastRequest.ContextJson, StringComparison.Ordinal);
    }

    private static PlanningContext Context()
    {
        var controls = ImmutableArray.Create(
            new VisibleControl("g1-f0-c0", "textbox", "First name", "text", true, true, false, false, null, []),
            new VisibleControl("g1-f0-c1", "textbox", "Social Security number", "text", true, true, false, true, null, []));
        var observation = new PageObservation(
            1,
            Guid.NewGuid(),
            7,
            new Uri("https://jobs.example.test/apply"),
            "Application",
            PageKind.ApplicationStep,
            controls,
            [],
            [1, 2, 3],
            DateTimeOffset.UtcNow);
        return new PlanningContext(
            Guid.NewGuid(),
            "Complete this job application through final review.",
            "Personal information",
            observation,
            [new RelevantAnswer("First name", "Ada", false, true)],
            100,
            50);
    }

    private sealed class FakePrivateAi(string output) : IPrivateAiInference
    {
        public int CallCount { get; private set; }
        public VisionInferenceRequest? LastRequest { get; private set; }

        public Task<VisionInferenceResult> InferAsync(
            VisionInferenceRequest request,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            LastRequest = request;
            return Task.FromResult(new VisionInferenceResult(
                output,
                "fake-vision",
                "1",
                "fake",
                TimeSpan.Zero));
        }

        public Task<DocumentParsingResult> ParseDocumentAsync(
            DocumentParsingRequest request,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
