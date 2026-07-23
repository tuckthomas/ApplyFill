using Microsoft.Playwright;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class PlaywrightRuntimeSmokeTests
{
    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task PinnedChromiumRendersAndAcceptsStructuredInput()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            ViewportSize = new ViewportSize { Width = 960, Height = 640 }
        });
        var page = await context.NewPageAsync();
        await page.SetContentAsync("""
            <!doctype html>
            <html><body>
              <label>First name <input name="firstName" required></label>
              <button type="button" onclick="document.body.dataset.saved='yes'">Save and continue</button>
            </body></html>
            """);

        await page.GetByLabel("First name").FillAsync("Tucker");
        await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Save and continue" }).ClickAsync();
        var frame = await page.ScreenshotAsync(new PageScreenshotOptions { Type = ScreenshotType.Jpeg, Quality = 65 });

        Assert.Equal("Tucker", await page.GetByLabel("First name").InputValueAsync());
        Assert.Equal("yes", await page.Locator("body").GetAttributeAsync("data-saved"));
        Assert.True(frame.Length > 1_000);
        await context.CloseAsync();
    }
}
