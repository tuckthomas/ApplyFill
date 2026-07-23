using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Orchestration;

internal static class BrowserInputMapper
{
    public static BrowserInput Map(
        BrowserInputRequest request,
        ViewportFrame acknowledgedFrame,
        ViewportFrame currentFrame)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(acknowledgedFrame);
        ArgumentNullException.ThrowIfNull(currentFrame);
        if (acknowledgedFrame.SessionId != currentFrame.SessionId ||
            currentFrame.Sequence < acknowledgedFrame.Sequence ||
            request.FrameSequence != acknowledgedFrame.Sequence ||
            request.PageGeneration != acknowledgedFrame.PageGeneration ||
            currentFrame.PageGeneration != acknowledgedFrame.PageGeneration)
        {
            throw new InvalidOperationException("The visible page changed before this input arrived.");
        }

        var kind = request.Kind switch
        {
            "pointer" when request.Event == "move" => BrowserInputKind.PointerMove,
            "pointer" when request.Event == "down" => BrowserInputKind.PointerDown,
            "pointer" when request.Event == "up" => BrowserInputKind.PointerUp,
            "wheel" => BrowserInputKind.Wheel,
            "key" when request.Event == "down" => BrowserInputKind.KeyDown,
            "key" when request.Event == "up" => BrowserInputKind.KeyUp,
            "resize" => BrowserInputKind.Resize,
            _ => throw new InvalidOperationException("That browser input is not supported."),
        };
        var (x, y) = ScalePoint(request, acknowledgedFrame, currentFrame, kind);
        ValidateResize(request, kind);
        return new BrowserInput(
            kind,
            acknowledgedFrame.PageGeneration,
            acknowledgedFrame.Sequence,
            x,
            y,
            request.DeltaX,
            request.DeltaY,
            request.Key,
            null,
            request.Button,
            request.Alt,
            request.Control,
            request.Meta,
            request.Shift,
            request.ViewportWidth,
            request.ViewportHeight);
    }

    private static (double? X, double? Y) ScalePoint(
        BrowserInputRequest request,
        ViewportFrame acknowledgedFrame,
        ViewportFrame currentFrame,
        BrowserInputKind kind)
    {
        if (kind is not (BrowserInputKind.PointerMove or BrowserInputKind.PointerDown or
            BrowserInputKind.PointerUp or BrowserInputKind.Wheel))
        {
            return (null, null);
        }

        if (request.X is not { } x || request.Y is not { } y ||
            x < 0 || y < 0 || x >= acknowledgedFrame.Width || y >= acknowledgedFrame.Height)
        {
            throw new InvalidOperationException("Pointer input is outside the acknowledged frame.");
        }

        return (
            x * currentFrame.Width / acknowledgedFrame.Width,
            y * currentFrame.Height / acknowledgedFrame.Height);
    }

    private static void ValidateResize(BrowserInputRequest request, BrowserInputKind kind)
    {
        if (kind != BrowserInputKind.Resize)
        {
            return;
        }

        if (request.ViewportWidth is not (>= 320 and <= 3840) ||
            request.ViewportHeight is not (>= 240 and <= 2160))
        {
            throw new InvalidOperationException("The requested browser size is outside the supported range.");
        }
    }
}
