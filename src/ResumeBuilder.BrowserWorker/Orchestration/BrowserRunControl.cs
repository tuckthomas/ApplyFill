using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Runtime;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public sealed class BrowserRunControl
{
    private readonly ControlLeaseManager _leases;
    private readonly IManagedBrowserRuntime _browser;
    private readonly TimeProvider _timeProvider;

    public BrowserRunControl(ControlLeaseManager leases, IManagedBrowserRuntime browser, TimeProvider? timeProvider = null)
    {
        _leases = leases;
        _browser = browser;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public ControlLease TakeControl(ApplicationRun run, Guid sessionId)
    {
        var lease = _leases.TakeUserControl(sessionId);
        if (run.State != RunState.UserControl)
            run.Transition(RunState.UserControl, RunActor.User, "User took control", _timeProvider.GetUtcNow(), run.Version);
        return lease;
    }

    public ControlLease Pause(ApplicationRun run, Guid sessionId)
    {
        var current = _leases.Get(sessionId);
        if (current.Owner == ControlOwner.Agent) _leases.Release(sessionId, ControlOwner.Agent);
        if (run.State != RunState.Paused)
        {
            run.Transition(RunState.Pausing, RunActor.User, "Pause requested", _timeProvider.GetUtcNow(), run.Version);
            run.Transition(RunState.Paused, RunActor.System, "Agent input stopped", _timeProvider.GetUtcNow(), run.Version);
        }
        return _leases.Get(sessionId);
    }

    public (ControlLease Lease, CancellationToken AgentCancellation) Resume(ApplicationRun run, Guid sessionId)
    {
        var current = _leases.Get(sessionId);
        if (current.Owner == ControlOwner.User) _leases.Release(sessionId, ControlOwner.User);
        var lease = _leases.AcquireAgent(sessionId);
        if (run.State == RunState.Paused)
        {
            run.Transition(RunState.Recovering, RunActor.System, "Resume requested", _timeProvider.GetUtcNow(), run.Version);
            run.Transition(RunState.Observing, RunActor.System, "Refreshing the page before resuming", _timeProvider.GetUtcNow(), run.Version);
        }
        else if (run.State == RunState.UserControl)
        {
            run.Transition(RunState.Observing, RunActor.User, "User returned control", _timeProvider.GetUtcNow(), run.Version);
        }
        return lease;
    }

    public async Task StopAsync(ApplicationRun run, Guid sessionId, string ownerId, CancellationToken cancellationToken)
    {
        var lease = _leases.Get(sessionId);
        if (lease.Owner != ControlOwner.None) _leases.Release(sessionId, lease.Owner);
        if (run.State is not (RunState.Stopped or RunState.Completed))
            run.Transition(RunState.Stopped, RunActor.User, "Emergency stop", _timeProvider.GetUtcNow(), run.Version);
        await _browser.StopAsync(sessionId, ownerId, cancellationToken);
    }
}
