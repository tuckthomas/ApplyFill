using ResumeBuilder.BrowserWorker.Runtime;

namespace ResumeBuilder.BrowserWorker.Streaming;

internal readonly record struct FramePacingDecision(
    TimeSpan Delay,
    int FramesPerSecond,
    bool Backpressured);

internal sealed class FramePacingPolicy
{
    private readonly int _normalFramesPerSecond;
    private readonly int _lowFramesPerSecond;
    private readonly int _maxFrameBytes;
    private readonly int _healthyFramesBeforeRecovery;
    private int _consecutiveHealthyFrames;
    private bool _backpressured;

    public FramePacingPolicy(FramePumpOptions options)
    {
        _normalFramesPerSecond = Math.Clamp(options.FramesPerSecond, 1, 15);
        _lowFramesPerSecond = Math.Clamp(options.LowBandwidthFramesPerSecond, 1, _normalFramesPerSecond);
        _maxFrameBytes = Math.Max(options.MaxFrameBytes, 1);
        _healthyFramesBeforeRecovery = Math.Clamp(options.HealthyFramesBeforeRecovery, 1, 30);
    }

    public bool CanPublish(int frameBytes) => frameBytes > 0 && frameBytes <= _maxFrameBytes;

    public FramePacingDecision Record(TimeSpan workElapsed, int frameBytes, bool published)
    {
        var normalInterval = Interval(_normalFramesPerSecond);
        var underPressure = !published || !CanPublish(frameBytes) || workElapsed >= normalInterval;
        if (underPressure)
        {
            _backpressured = true;
            _consecutiveHealthyFrames = 0;
        }
        else if (_backpressured && ++_consecutiveHealthyFrames >= _healthyFramesBeforeRecovery)
        {
            _backpressured = false;
            _consecutiveHealthyFrames = 0;
        }

        var framesPerSecond = _backpressured ? _lowFramesPerSecond : _normalFramesPerSecond;
        var interval = Interval(framesPerSecond);
        return new FramePacingDecision(
            workElapsed < interval ? interval - workElapsed : TimeSpan.Zero,
            framesPerSecond,
            _backpressured);
    }

    private static TimeSpan Interval(int framesPerSecond) =>
        TimeSpan.FromMilliseconds(1000d / framesPerSecond);
}
