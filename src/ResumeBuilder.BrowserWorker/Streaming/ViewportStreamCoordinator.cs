using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Runtime;

namespace ResumeBuilder.BrowserWorker.Streaming;

public interface IBrowserAgentClient
{
    Task RunUpdated(BrowserRunSnapshot snapshot);
    Task FrameAvailable(FrameAvailableMessage frame);
}

public sealed partial class ViewportStreamCoordinator : IAsyncDisposable
{
    private sealed class Subscription : IDisposable
    {
        public required Guid SessionId { get; init; }
        public required Guid RunId { get; init; }
        public required string OwnerId { get; init; }
        public readonly ConcurrentDictionary<string, byte> Connections = new(StringComparer.Ordinal);
        public readonly CancellationTokenSource Cancellation = new();
        public Task? Pump;
        private int _disposed;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
            Cancellation.Cancel();
            Cancellation.Dispose();
        }
    }

    private readonly ConcurrentDictionary<Guid, Subscription> _subscriptions = new();
    private readonly ConcurrentDictionary<string, Guid> _connections = new(StringComparer.Ordinal);
    private readonly IManagedBrowserRuntime _browser;
    private readonly IHubContext<BrowserAgentHub, IBrowserAgentClient> _hub;
    private readonly FramePumpOptions _options;
    private readonly LatestFrameStore _frames;
    private readonly ILogger<ViewportStreamCoordinator> _logger;

    public ViewportStreamCoordinator(
        IManagedBrowserRuntime browser,
        IHubContext<BrowserAgentHub, IBrowserAgentClient> hub,
        LatestFrameStore frames,
        IOptions<FramePumpOptions> options,
        ILogger<ViewportStreamCoordinator> logger)
    {
        _browser = browser;
        _hub = hub;
        _frames = frames;
        _options = options.Value;
        _logger = logger;
    }

    public void Subscribe(Guid runId, Guid sessionId, string ownerId, string connectionId)
    {
        var subscription = _subscriptions.GetOrAdd(sessionId, _ => new Subscription { RunId = runId, SessionId = sessionId, OwnerId = ownerId });
        if (subscription.OwnerId != ownerId) throw new UnauthorizedAccessException("Browser session ownership mismatch.");
        subscription.Connections[connectionId] = 0;
        _connections[connectionId] = sessionId;
        lock (subscription)
        {
            subscription.Pump ??= PumpAsync(subscription);
        }
    }

    public void Unsubscribe(string connectionId)
    {
        if (!_connections.TryRemove(connectionId, out var sessionId) || !_subscriptions.TryGetValue(sessionId, out var subscription)) return;
        subscription.Connections.TryRemove(connectionId, out _);
        if (!subscription.Connections.IsEmpty) return;
        if (_subscriptions.TryRemove(sessionId, out _))
        {
            subscription.Cancellation.Cancel();
        }
    }

    private async Task PumpAsync(Subscription subscription)
    {
        var pacing = new FramePacingPolicy(_options);
        try
        {
            while (!subscription.Cancellation.IsCancellationRequested)
            {
                var started = TimeProvider.System.GetTimestamp();
                var frame = await _browser.CaptureFrameAsync(subscription.SessionId, subscription.OwnerId, subscription.Cancellation.Token);
                var published = false;
                if (pacing.CanPublish(frame.JpegBytes.Length))
                {
                    _frames.Put(subscription.RunId, frame);
                    await _hub.Clients.Group(GroupName(subscription.RunId)).FrameAvailable(new FrameAvailableMessage(
                        subscription.RunId.ToString(),
                        $"/api/browser-agent/runs/{subscription.RunId}/frame/latest?sequence={frame.Sequence}",
                        frame.CapturedAt,
                        frame.Width,
                        frame.Height,
                        frame.Sequence,
                        frame.PageGeneration,
                        frame.DeviceScaleFactor));
                    published = true;
                }
                else
                {
                    LogOversizedFrameDropped(_logger, subscription.SessionId, frame.JpegBytes.Length);
                }

                var elapsed = TimeProvider.System.GetElapsedTime(started);
                var decision = pacing.Record(elapsed, frame.JpegBytes.Length, published);
                if (decision.Delay > TimeSpan.Zero)
                {
                    await Task.Delay(decision.Delay, subscription.Cancellation.Token);
                }
            }
        }
        catch (OperationCanceledException) when (subscription.Cancellation.IsCancellationRequested) { }
        catch (BrowserRuntimeException exception)
        {
            LogBrowserRuntimeStopped(_logger, subscription.SessionId, exception.Code);
        }
        catch (Exception exception)
        {
            LogStreamStopped(_logger, subscription.SessionId, exception.GetType().Name);
        }
        finally
        {
            if (!_subscriptions.TryGetValue(subscription.SessionId, out var current) || ReferenceEquals(current, subscription))
            {
                _subscriptions.TryRemove(subscription.SessionId, out _);
                _frames.Remove(subscription.RunId, subscription.SessionId);
            }

            foreach (var connectionId in subscription.Connections.Keys)
            {
                _connections.TryRemove(connectionId, out _);
            }
            subscription.Dispose();
        }
    }

    public async ValueTask DisposeAsync()
    {
        var subscriptions = _subscriptions.Values.ToArray();
        foreach (var subscription in subscriptions) subscription.Cancellation.Cancel();
        await Task.WhenAll(subscriptions.Select(subscription => subscription.Pump ?? Task.CompletedTask));
        foreach (var subscription in subscriptions) subscription.Dispose();
        _subscriptions.Clear();
        _connections.Clear();
    }

    public static string GroupName(Guid runId) => $"browser-run:{runId:N}";

    [LoggerMessage(LogLevel.Warning, "Viewport stream stopped for session {SessionId} with failure type {FailureType}.")]
    private static partial void LogStreamStopped(ILogger logger, Guid sessionId, string failureType);

    [LoggerMessage(LogLevel.Warning, "Viewport stream stopped for session {SessionId} with browser failure {FailureCode}.")]
    private static partial void LogBrowserRuntimeStopped(ILogger logger, Guid sessionId, string failureCode);

    [LoggerMessage(LogLevel.Debug, "Dropped oversized viewport frame for session {SessionId}: {FrameBytes} bytes.")]
    private static partial void LogOversizedFrameDropped(ILogger logger, Guid sessionId, int frameBytes);
}
