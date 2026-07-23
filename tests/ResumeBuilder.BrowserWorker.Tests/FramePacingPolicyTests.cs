using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Streaming;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class FramePacingPolicyTests
{
    [Fact]
    public void OversizedOrSlowFramesSwitchToBoundedLowFrameRateAndRecoverGradually()
    {
        var policy = new FramePacingPolicy(new FramePumpOptions
        {
            FramesPerSecond = 5,
            LowBandwidthFramesPerSecond = 2,
            MaxFrameBytes = 100,
            HealthyFramesBeforeRecovery = 2,
        });

        Assert.True(policy.CanPublish(100));
        Assert.False(policy.CanPublish(101));

        var pressured = policy.Record(TimeSpan.FromMilliseconds(50), frameBytes: 101, published: false);
        Assert.True(pressured.Backpressured);
        Assert.Equal(2, pressured.FramesPerSecond);
        Assert.Equal(TimeSpan.FromMilliseconds(450), pressured.Delay);

        var firstHealthy = policy.Record(TimeSpan.FromMilliseconds(50), frameBytes: 50, published: true);
        Assert.True(firstHealthy.Backpressured);
        Assert.Equal(2, firstHealthy.FramesPerSecond);

        var recovered = policy.Record(TimeSpan.FromMilliseconds(50), frameBytes: 50, published: true);
        Assert.False(recovered.Backpressured);
        Assert.Equal(5, recovered.FramesPerSecond);
        Assert.Equal(TimeSpan.FromMilliseconds(150), recovered.Delay);

        var slow = policy.Record(TimeSpan.FromMilliseconds(250), frameBytes: 50, published: true);
        Assert.True(slow.Backpressured);
        Assert.Equal(2, slow.FramesPerSecond);
        Assert.Equal(TimeSpan.FromMilliseconds(250), slow.Delay);
    }
}
