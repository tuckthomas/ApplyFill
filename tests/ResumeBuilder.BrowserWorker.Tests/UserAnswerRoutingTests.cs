using System.Collections.Immutable;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class UserAnswerRoutingTests
{
    [Fact]
    public void SelectedOptionMapsToItsOnlyVisibleControl()
    {
        var observation = Observation(
            Control("country", "Country", ["United States", "Canada"]),
            Control("authorized", "Authorized to work", ["Yes", "No"]));
        var yield = new OrchestrationYield(
            RunState.AwaitingUser,
            "answer-required",
            "Choose an answer.",
            observation,
            "Are you authorized to work?",
            ["United States", "Canada", "Yes", "No"]);

        var value = BrowserAgentRunService.ResolveAnswerValue(
            yield,
            new BrowserQuestionAnswerRequest("2", null, false, 1));
        var control = BrowserAgentRunService.ResolveAnswerControl(yield, value);

        Assert.Equal("Yes", value);
        Assert.Equal("authorized", control?.Handle);
    }

    [Fact]
    public void AmbiguousAnswerDoesNotSelectAControl()
    {
        var observation = Observation(
            Control("first", "First confirmation", ["Yes", "No"]),
            Control("second", "Second confirmation", ["Yes", "No"]));
        var yield = new OrchestrationYield(
            RunState.AwaitingUser,
            "answer-required",
            "Choose an answer.",
            observation,
            "Please answer this question.",
            ["Yes", "No"]);

        var control = BrowserAgentRunService.ResolveAnswerControl(yield, "Yes");

        Assert.Null(control);
    }

    [Fact]
    public void InboxRetainsAnswerUntilVerifiedActionRemovesIt()
    {
        var runId = Guid.NewGuid();
        var inbox = new InMemoryUserAnswerInbox();
        inbox.Put(new UserAnswer(runId, "question", "control", "Country", "Canada", DateTimeOffset.UtcNow));

        Assert.True(inbox.TryGet(runId, out var answer));
        Assert.Equal("Canada", answer?.Value);

        inbox.Remove(runId);

        Assert.False(inbox.TryGet(runId, out _));
    }

    private static VisibleControl Control(string handle, string label, ImmutableArray<string> options) => new(
        handle,
        "combobox",
        label,
        "select-one",
        Required: true,
        Enabled: true,
        Checked: false,
        Sensitive: false,
        CurrentValue: null,
        Options: options);

    private static PageObservation Observation(params VisibleControl[] controls) => new(
        1,
        Guid.NewGuid(),
        1,
        new Uri("https://jobs.example.test/apply"),
        "Application",
        PageKind.ApplicationStep,
        controls.ToImmutableArray(),
        [],
        [1, 2, 3],
        DateTimeOffset.UtcNow);
}
