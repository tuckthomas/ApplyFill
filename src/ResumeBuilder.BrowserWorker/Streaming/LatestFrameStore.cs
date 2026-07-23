using System.Collections.Concurrent;
using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Streaming;

public sealed class LatestFrameStore
{
    private const int RetainedFramesPerSession = 8;

    private sealed class FrameHistory(Guid runId)
    {
        public Guid RunId { get; } = runId;
        public Queue<ViewportFrame> Frames { get; } = new(RetainedFramesPerSession);
    }

    private readonly ConcurrentDictionary<Guid, FrameHistory> _bySession = new();
    private readonly ConcurrentDictionary<Guid, Guid> _sessionByRun = new();

    public void Put(Guid runId, ViewportFrame frame)
    {
        var history = _bySession.GetOrAdd(frame.SessionId, _ => new FrameHistory(runId));
        if (history.RunId != runId)
        {
            throw new InvalidOperationException("A browser session cannot publish frames for multiple runs.");
        }

        lock (history.Frames)
        {
            history.Frames.Enqueue(frame);
            while (history.Frames.Count > RetainedFramesPerSession)
            {
                history.Frames.Dequeue();
            }
        }

        _sessionByRun[runId] = frame.SessionId;
    }

    public ViewportFrame? GetByRun(Guid runId) => GetHistoryByRun(runId) is { } history
        ? GetLatest(history)
        : null;

    public ViewportFrame? GetByRun(Guid runId, long sequence) => GetHistoryByRun(runId) is { } history
        ? GetBySequence(history, sequence)
        : null;

    public ViewportFrame? GetBySession(Guid sessionId) =>
        _bySession.TryGetValue(sessionId, out var history) ? GetLatest(history) : null;

    public void Remove(Guid runId, Guid sessionId)
    {
        _sessionByRun.TryRemove(runId, out _);
        _bySession.TryRemove(sessionId, out _);
    }

    private FrameHistory? GetHistoryByRun(Guid runId) =>
        _sessionByRun.TryGetValue(runId, out var sessionId) && _bySession.TryGetValue(sessionId, out var history)
            ? history
            : null;

    private static ViewportFrame? GetLatest(FrameHistory history)
    {
        lock (history.Frames)
        {
            return history.Frames.TryPeek(out _) ? history.Frames.Last() : null;
        }
    }

    private static ViewportFrame? GetBySequence(FrameHistory history, long sequence)
    {
        lock (history.Frames)
        {
            return history.Frames.FirstOrDefault(frame => frame.Sequence == sequence);
        }
    }
}
