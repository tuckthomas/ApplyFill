using Microsoft.AspNetCore.SignalR;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Security;

namespace ResumeBuilder.BrowserWorker.Streaming;

public sealed class BrowserAgentHub : Hub<IBrowserAgentClient>
{
    private readonly BrowserAgentRunService _runs;
    private readonly ViewportStreamCoordinator _streams;

    public BrowserAgentHub(
        BrowserAgentRunService runs,
        ViewportStreamCoordinator streams)
    {
        _runs = runs;
        _streams = streams;
    }

    public async Task WatchRun(string runId)
    {
        if (!Guid.TryParse(runId, out var id) || !_runs.TryGetStreamingBinding(id, out var sessionId, out var ownerId))
            throw new HubException("Browser run was not found.");

        Context.Items["runId"] = id;
        await Groups.AddToGroupAsync(Context.ConnectionId, ViewportStreamCoordinator.GroupName(id), Context.ConnectionAborted);
        _streams.Subscribe(id, sessionId, ownerId, Context.ConnectionId);
        await Clients.Caller.RunUpdated(await _runs.GetAsync(id, Context.ConnectionAborted));
    }

    public async Task LeaveRun(string runId)
    {
        if (Guid.TryParse(runId, out var id))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, ViewportStreamCoordinator.GroupName(id), Context.ConnectionAborted);
        _streams.Unsubscribe(Context.ConnectionId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _streams.Unsubscribe(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

}
