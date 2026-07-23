using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.BrowserWorker.Streaming;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class BrowserInputContractTests
{
    [Fact]
    public void AcknowledgedFrameCoordinatesScaleToTheCurrentViewport()
    {
        var sessionId = Guid.CreateVersion7();
        var acknowledged = Frame(sessionId, sequence: 40, generation: 7, width: 1280, height: 720);
        var current = Frame(sessionId, sequence: 42, generation: 7, width: 1920, height: 1080);
        var request = Request(
            kind: "pointer",
            @event: "down",
            frameSequence: 40,
            pageGeneration: 7,
            x: 640,
            y: 360);

        var input = BrowserInputMapper.Map(request, acknowledged, current);

        Assert.Equal(BrowserInputKind.PointerDown, input.Kind);
        Assert.Equal(960, input.X);
        Assert.Equal(540, input.Y);
        Assert.Equal(40, input.FrameSequence);
        Assert.Equal(7, input.PageGeneration);
    }

    [Fact]
    public void InputFromAnOldPageGenerationIsRejected()
    {
        var sessionId = Guid.CreateVersion7();
        var acknowledged = Frame(sessionId, sequence: 40, generation: 7, width: 1280, height: 720);
        var current = Frame(sessionId, sequence: 41, generation: 8, width: 1280, height: 720);
        var request = Request(
            kind: "key",
            @event: "down",
            frameSequence: 40,
            pageGeneration: 7,
            key: "Enter");

        var exception = Assert.Throws<InvalidOperationException>(() =>
            BrowserInputMapper.Map(request, acknowledged, current));

        Assert.Contains("visible page changed", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ExactFramesRemainAddressableForBoundedInputLatency()
    {
        var store = new LatestFrameStore();
        var runId = Guid.CreateVersion7();
        var sessionId = Guid.CreateVersion7();
        for (var sequence = 1; sequence <= 9; sequence++)
        {
            store.Put(runId, Frame(sessionId, sequence, generation: 1, width: 1280, height: 720));
        }

        Assert.Null(store.GetByRun(runId, 1));
        Assert.Equal(2, store.GetByRun(runId, 2)?.Sequence);
        Assert.Equal(9, store.GetByRun(runId)?.Sequence);
    }

    [Fact]
    public void ViewportResizeUsesTheAcknowledgedFrameAndEnforcesBounds()
    {
        var sessionId = Guid.CreateVersion7();
        var frame = Frame(sessionId, sequence: 12, generation: 3, width: 1280, height: 720);
        var valid = Request(
            kind: "resize",
            @event: null,
            frameSequence: 12,
            pageGeneration: 3,
            viewportWidth: 1440,
            viewportHeight: 900);

        var input = BrowserInputMapper.Map(valid, frame, frame);

        Assert.Equal(BrowserInputKind.Resize, input.Kind);
        Assert.Equal(1440, input.ViewportWidth);
        Assert.Equal(900, input.ViewportHeight);

        var invalid = valid with { ViewportWidth = 100 };
        Assert.Throws<InvalidOperationException>(() => BrowserInputMapper.Map(invalid, frame, frame));
    }

    private static BrowserInputRequest Request(
        string kind,
        string? @event,
        long frameSequence,
        long pageGeneration,
        double? x = null,
        double? y = null,
        string? key = null,
        int? viewportWidth = null,
        int? viewportHeight = null) => new(
        kind,
        @event,
        x,
        y,
        Button: 0,
        DeltaX: null,
        DeltaY: null,
        Key: key,
        Code: key,
        Alt: false,
        Control: false,
        Meta: false,
        Shift: false,
        FrameSequence: frameSequence,
        PageGeneration: pageGeneration,
        ViewportWidth: viewportWidth,
        ViewportHeight: viewportHeight);

    private static ViewportFrame Frame(
        Guid sessionId,
        long sequence,
        long generation,
        int width,
        int height) => new(
        sessionId,
        sequence,
        generation,
        width,
        height,
        DeviceScaleFactor: 1,
        CapturedAt: DateTimeOffset.UtcNow,
        JpegBytes: [1, 2, 3]);
}
