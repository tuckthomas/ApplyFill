using System.Collections.Immutable;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class DeterministicResolverTests
{
    [Fact]
    public void RequiredVisibleFieldIsMappedWithoutModelCall()
    {
        var resolver = new DeterministicActionResolver();
        var observation = Observation(new VisibleControl("g5-f0-c1", "textbox", "First Name", "text", true, true, false, false, null, []));

        var action = resolver.Resolve(observation, [new RelevantAnswer("first-name", "Tucker", false, false)]);

        Assert.NotNull(action);
        Assert.Equal(BrowserActionKind.Type, action.Kind);
        Assert.Equal("Tucker", action.Value);
        Assert.Equal(5, action.PageGeneration);
    }

    [Fact]
    public void SensitiveAnswerIsNotUsedWithoutCurrentApproval()
    {
        var resolver = new DeterministicActionResolver();
        var observation = Observation(new VisibleControl("g5-f0-c1", "textbox", "National ID", "text", true, true, false, true, null, []));

        var action = resolver.Resolve(observation, [new RelevantAnswer("National ID", "private", true, false)]);

        Assert.Null(action);
    }

    [Fact]
    public void RequiredFileInputUsesOnlyTheRunApprovedArtifact()
    {
        var resolver = new DeterministicActionResolver();
        var observation = Observation(new VisibleControl(
            "g5-f0-c1", "textbox", "Resume", "file", true, true, false, false, null, []));
        var artifact = new ApprovedArtifact(
            Guid.NewGuid(), Guid.NewGuid(), "reviewed.pdf", "application/pdf", 128,
            new string('A', 64), "staged.pdf", DateTimeOffset.UtcNow.AddMinutes(5));

        var action = resolver.Resolve(observation, [], artifact);

        Assert.NotNull(action);
        Assert.Equal(BrowserActionKind.UploadApprovedArtifact, action.Kind);
        Assert.Equal(artifact.Id, action.ArtifactId);
        Assert.Equal("g5-f0-c1", action.Handle);
    }

    private static PageObservation Observation(VisibleControl control) =>
        new(1, Guid.NewGuid(), 5, new Uri("https://jobs.example.com/apply"), "Apply", PageKind.ApplicationStep,
            [control], ImmutableArray<string>.Empty, [], DateTimeOffset.UtcNow);
}
