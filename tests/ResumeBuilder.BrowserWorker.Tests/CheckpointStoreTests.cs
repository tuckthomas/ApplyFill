using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class CheckpointStoreTests
{
    [Fact]
    public async Task CheckpointsAreOrderedAndDoNotStoreRawPageContent()
    {
        var store = new InMemoryRunCheckpointStore();
        var runId = Guid.NewGuid();
        await store.AppendAsync(Create(runId, 1, "Fill contact details"), TestContext.Current.CancellationToken);
        await store.AppendAsync(Create(runId, 2, "Advance to experience"), TestContext.Current.CancellationToken);

        var activity = await store.GetActivityAsync(runId, TestContext.Current.CancellationToken);

        Assert.Equal([1L, 2L], activity.Select(item => item.Sequence));
        Assert.All(activity, item => Assert.True(item.Intent.Length < 100));
    }

    [Fact]
    public async Task DuplicateOrGappedCheckpointSequenceIsRejected()
    {
        var store = new InMemoryRunCheckpointStore();
        var runId = Guid.NewGuid();
        await store.AppendAsync(Create(runId, 1, "First"), TestContext.Current.CancellationToken);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            store.AppendAsync(Create(runId, 3, "Gap"), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task PerRunDeleteRemovesRecoveryHistory()
    {
        var store = new InMemoryRunCheckpointStore();
        var runId = Guid.NewGuid();
        await store.AppendAsync(Create(runId, 1, "First"), TestContext.Current.CancellationToken);
        await store.DeleteAsync(runId, TestContext.Current.CancellationToken);

        Assert.Null(await store.GetLatestAsync(runId, TestContext.Current.CancellationToken));
    }

    private static Checkpoint Create(Guid runId, long sequence, string intent) =>
        new(Guid.NewGuid(), runId, sequence, RunState.Observing, "Contact", new Uri("https://jobs.example.com/apply"), 2,
            intent, "First name", "verified", ControlOwner.Agent, DateTimeOffset.UtcNow, false, false);
}
