using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Runtime;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class ControlLeaseManagerTests
{
    [Fact]
    public void UserTakeoverCancelsAgentBeforeChangingEpoch()
    {
        var manager = new ControlLeaseManager();
        var sessionId = Guid.NewGuid();
        var (agentLease, cancellation) = manager.AcquireAgent(sessionId);

        var userLease = manager.TakeUserControl(sessionId);

        Assert.True(cancellation.IsCancellationRequested);
        Assert.Equal(ControlOwner.User, userLease.Owner);
        Assert.True(userLease.Epoch > agentLease.Epoch);
        Assert.Throws<UnauthorizedAccessException>(() => manager.AssertOwner(sessionId, ControlOwner.Agent, agentLease.Epoch));
    }

    [Fact]
    public async Task ConcurrentTakeoverNeverLeavesBothOwners()
    {
        var manager = new ControlLeaseManager();
        var sessionId = Guid.NewGuid();
        manager.AcquireAgent(sessionId);

        await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Task.Run(() => manager.TakeUserControl(sessionId))));

        Assert.Equal(ControlOwner.User, manager.Get(sessionId).Owner);
        Assert.Throws<InvalidOperationException>(() => manager.AcquireAgent(sessionId));
    }

    [Fact]
    public void StaleUserEpochIsRejectedAfterReturningControl()
    {
        var manager = new ControlLeaseManager();
        var sessionId = Guid.NewGuid();
        manager.AcquireAgent(sessionId);
        var user = manager.TakeUserControl(sessionId);
        manager.Release(sessionId, ControlOwner.User);
        manager.AcquireAgent(sessionId);

        Assert.Throws<UnauthorizedAccessException>(() => manager.AssertOwner(sessionId, ControlOwner.User, user.Epoch));
    }
}
