using System.Collections.Concurrent;
using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Runtime;

public sealed class ControlLeaseManager
{
    private sealed class LeaseState : IDisposable
    {
        public readonly Lock Gate = new();
        public ControlOwner Owner;
        public long Epoch;
        public DateTimeOffset AcquiredAt;
        public CancellationTokenSource AgentCancellation = new();

        public void Dispose()
        {
            AgentCancellation.Cancel();
            AgentCancellation.Dispose();
        }
    }

    private readonly ConcurrentDictionary<Guid, LeaseState> _leases = new();
    private readonly TimeProvider _timeProvider;

    public ControlLeaseManager(TimeProvider? timeProvider = null) =>
        _timeProvider = timeProvider ?? TimeProvider.System;

    public ControlLease Get(Guid sessionId)
    {
        var state = _leases.GetOrAdd(sessionId, _ => new LeaseState());
        lock (state.Gate)
        {
            return Snapshot(sessionId, state);
        }
    }

    public (ControlLease Lease, CancellationToken AgentCancellation) AcquireAgent(Guid sessionId)
    {
        var state = _leases.GetOrAdd(sessionId, _ => new LeaseState());
        lock (state.Gate)
        {
            if (state.Owner == ControlOwner.User)
            {
                throw new InvalidOperationException("The user currently controls this browser session.");
            }

            state.AgentCancellation.Dispose();
            state.AgentCancellation = new CancellationTokenSource();
            state.Owner = ControlOwner.Agent;
            state.Epoch++;
            state.AcquiredAt = _timeProvider.GetUtcNow();
            return (Snapshot(sessionId, state), state.AgentCancellation.Token);
        }
    }

    public ControlLease TakeUserControl(Guid sessionId)
    {
        var state = _leases.GetOrAdd(sessionId, _ => new LeaseState());
        lock (state.Gate)
        {
            state.AgentCancellation.Cancel();
            state.Owner = ControlOwner.User;
            state.Epoch++;
            state.AcquiredAt = _timeProvider.GetUtcNow();
            return Snapshot(sessionId, state);
        }
    }

    public ControlLease Release(Guid sessionId, ControlOwner expectedOwner)
    {
        var state = _leases.GetOrAdd(sessionId, _ => new LeaseState());
        lock (state.Gate)
        {
            if (state.Owner != expectedOwner)
            {
                throw new InvalidOperationException($"Cannot release {expectedOwner} control while {state.Owner} owns it.");
            }

            if (state.Owner == ControlOwner.Agent)
            {
                state.AgentCancellation.Cancel();
            }

            state.Owner = ControlOwner.None;
            state.Epoch++;
            state.AcquiredAt = _timeProvider.GetUtcNow();
            return Snapshot(sessionId, state);
        }
    }

    public void AssertOwner(Guid sessionId, ControlOwner owner, long? epoch = null)
    {
        var lease = Get(sessionId);
        if (lease.Owner != owner || (epoch.HasValue && lease.Epoch != epoch.Value))
        {
            throw new UnauthorizedAccessException("Browser control lease is stale or belongs to another actor.");
        }
    }

    public void Remove(Guid sessionId)
    {
        if (_leases.TryRemove(sessionId, out var state))
        {
            lock (state.Gate)
            {
                state.Dispose();
            }
        }
    }

    private static ControlLease Snapshot(Guid sessionId, LeaseState state) =>
        new(sessionId, state.Owner, state.Epoch, state.AcquiredAt);
}
