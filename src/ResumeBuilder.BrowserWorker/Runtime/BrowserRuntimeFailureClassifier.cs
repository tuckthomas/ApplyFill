using Microsoft.Playwright;

namespace ResumeBuilder.BrowserWorker.Runtime;

internal static class BrowserRuntimeFailureClassifier
{
    public static BrowserRuntimeException Classify(
        PlaywrightException exception,
        BrowserRuntimeFailureKind? observedFailure = null)
    {
        var kind = observedFailure ?? ClassifyMessage(exception.Message);
        return new BrowserRuntimeException(kind, Code(kind), Message(kind), exception);
    }

    public static string Code(BrowserRuntimeFailureKind kind) => kind switch
    {
        BrowserRuntimeFailureKind.BrowserCrashed => "browser-crashed",
        BrowserRuntimeFailureKind.PageCrashed => "page-crashed",
        BrowserRuntimeFailureKind.BrowserDisconnected => "browser-disconnected",
        BrowserRuntimeFailureKind.PageClosed => "page-closed",
        BrowserRuntimeFailureKind.TimedOut => "browser-timeout",
        _ => "playwright-error"
    };

    public static string Message(BrowserRuntimeFailureKind kind) => kind switch
    {
        BrowserRuntimeFailureKind.BrowserCrashed => "The managed browser stopped unexpectedly.",
        BrowserRuntimeFailureKind.PageCrashed => "The current application page crashed.",
        BrowserRuntimeFailureKind.BrowserDisconnected => "The managed browser disconnected.",
        BrowserRuntimeFailureKind.PageClosed => "The current application page was closed.",
        BrowserRuntimeFailureKind.TimedOut => "The page did not respond in time.",
        _ => "The browser could not complete the requested action."
    };

    private static BrowserRuntimeFailureKind ClassifyMessage(string message)
    {
        if (message.Contains("page crashed", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Page crashed", StringComparison.OrdinalIgnoreCase))
        {
            return BrowserRuntimeFailureKind.PageCrashed;
        }

        if (message.Contains("Target page, context or browser has been closed", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("browser disconnected", StringComparison.OrdinalIgnoreCase))
        {
            return BrowserRuntimeFailureKind.BrowserDisconnected;
        }

        if (message.Contains("page has been closed", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("page closed", StringComparison.OrdinalIgnoreCase))
        {
            return BrowserRuntimeFailureKind.PageClosed;
        }

        if (message.Contains("browser has been closed", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("browser closed", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("browser process", StringComparison.OrdinalIgnoreCase) &&
            message.Contains("exited", StringComparison.OrdinalIgnoreCase))
        {
            return BrowserRuntimeFailureKind.BrowserCrashed;
        }

        return message.Contains("Timeout", StringComparison.OrdinalIgnoreCase)
            ? BrowserRuntimeFailureKind.TimedOut
            : BrowserRuntimeFailureKind.ActionFailed;
    }
}
