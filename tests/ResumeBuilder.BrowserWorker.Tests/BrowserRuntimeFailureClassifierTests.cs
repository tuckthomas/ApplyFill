using Microsoft.Playwright;
using ResumeBuilder.BrowserWorker.Runtime;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class BrowserRuntimeFailureClassifierTests
{
    [Theory]
    [InlineData("Page crashed while taking screenshot", BrowserRuntimeFailureKind.PageCrashed, "page-crashed")]
    [InlineData("Browser has been closed unexpectedly", BrowserRuntimeFailureKind.BrowserCrashed, "browser-crashed")]
    [InlineData("Target page, context or browser has been closed", BrowserRuntimeFailureKind.BrowserDisconnected, "browser-disconnected")]
    [InlineData("Timeout 10000ms exceeded", BrowserRuntimeFailureKind.TimedOut, "browser-timeout")]
    [InlineData("Selector failed", BrowserRuntimeFailureKind.ActionFailed, "playwright-error")]
    public void ProducesStableContentFreeFailureCodes(
        string browserMessage,
        BrowserRuntimeFailureKind expectedKind,
        string expectedCode)
    {
        var classified = BrowserRuntimeFailureClassifier.Classify(new PlaywrightException(browserMessage));

        Assert.Equal(expectedKind, classified.Kind);
        Assert.Equal(expectedCode, classified.Code);
        Assert.DoesNotContain(browserMessage, classified.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void ObservedCrashStateOverridesAmbiguousPlaywrightMessage()
    {
        var classified = BrowserRuntimeFailureClassifier.Classify(
            new PlaywrightException("Target closed"),
            BrowserRuntimeFailureKind.PageCrashed);

        Assert.Equal(BrowserRuntimeFailureKind.PageCrashed, classified.Kind);
        Assert.Equal("page-crashed", classified.Code);
    }
}
