using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Playwright;

namespace ResumeBuilder.SyntheticAts;

public sealed class SyntheticAtsFixtureTests
{
    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task ThirteenStepApplicationExercisesBrowserSurfacesAndPersistsState()
    {
        await using var harness = await SyntheticAtsBrowserHarness.StartAsync();
        var page = await harness.NewPageAsync();

        await page.GotoAsync($"{harness.BaseUrl}/apply/step/1");
        await page.GetByLabel("Full name").FillAsync("Test Applicant");
        await page.GetByLabel("Email address").FillAsync("applicant@example.invalid");
        await page.GetByLabel("Phone number").FillAsync("+13175550100");
        await ContinueAsync(page, 2);

        await page.GetByLabel("Why are you interested?").FillAsync("Synthetic integration testing only.");
        await page.GetByLabel("Country").SelectOptionAsync("US");
        await page.GetByRole(AriaRole.Button, new() { Name = "Choose a department" }).ClickAsync();
        await page.GetByRole(AriaRole.Option, new() { Name = "Operations" }).ClickAsync();
        await page.GetByLabel("Preferred city").FillAsync("Indianapolis");
        await ContinueAsync(page, 3);

        await page.GetByLabel("Remote").CheckAsync();
        await page.GetByLabel("Available on weekends").CheckAsync();
        await page.GetByLabel("Earliest start date").FillAsync("2026-08-03");
        await ContinueAsync(page, 4);

        await page.GetByRole(AriaRole.Textbox, new() { Name = "Professional summary" })
            .FillAsync("Synthetic operations professional.");
        await page.GetByLabel("Employer 1").FillAsync("Fixture Bank");
        await page.GetByLabel("Employer 2").FillAsync("Example Credit Union");
        await page.GetByRole(AriaRole.Button, new() { Name = "Add another employer" }).ClickAsync();
        await page.GetByLabel("Employer 3").FillAsync("Generated Employer");
        await ContinueAsync(page, 5);

        await ContinueAsync(page, 6);
        Assert.Contains("redirected=true", page.Url, StringComparison.Ordinal);
        await page.GetByRole(AriaRole.Button, new() { Name = "Load review panel without leaving" }).ClickAsync();
        await Assertions.Expect(page.GetByRole(AriaRole.Heading, new() { Name = "SPA panel loaded" })).ToBeVisibleAsync();
        await page.GetByLabel("SPA-only answer").FillAsync("SPA state");
        Assert.Contains("panel=review", page.Url, StringComparison.Ordinal);
        await ContinueAsync(page, 7);

        var frame = page.FrameLocator("iframe[title='Authorization questions']");
        await frame.GetByLabel("Authorization detail").FillAsync("Authorized in synthetic fixture");
        await frame.GetByRole(AriaRole.Button, new() { Name = "Save frame answer" }).ClickAsync();
        await Assertions.Expect(frame.GetByRole(AriaRole.Status)).ToHaveTextAsync("Frame answer saved.");
        var shadowHost = page.Locator("#shadow-host");
        await shadowHost.GetByLabel("Portfolio access code").FillAsync("SHADOW-TEST");
        await shadowHost.GetByRole(AriaRole.Button, new() { Name = "Save shadow answer" }).ClickAsync();
        await ContinueAsync(page, 8);

        var popupTask = page.WaitForPopupAsync();
        await page.GetByRole(AriaRole.Button, new() { Name = "Open synthetic sign-in popup" }).ClickAsync();
        var popup = await popupTask;
        var popupClosed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        popup.Close += (_, _) => popupClosed.TrySetResult();
        await popup.GetByRole(AriaRole.Button, new() { Name = "Approve synthetic sign-in" }).ClickAsync();
        await popupClosed.Task;
        await page.GetByRole(AriaRole.Link, new() { Name = "Open unrelated benefits page" }).ClickAsync();
        await Assertions.Expect(page.GetByRole(AriaRole.Heading, new() { Name = "Benefits marketing page" })).ToBeVisibleAsync();
        await page.GoBackAsync();
        await Assertions.Expect(page.GetByRole(AriaRole.Heading, new() { Name = "Popup and history" })).ToBeVisibleAsync();
        await ContinueAsync(page, 9);

        var conditionalContinue = page.Locator("#continue-button");
        await Assertions.Expect(conditionalContinue).ToBeDisabledAsync();
        await page.GetByLabel("No").CheckAsync();
        await page.GetByLabel("Are you willing to relocate? (profile question)").SelectOptionAsync("Yes");
        await page.GetByLabel("Are you willing to relocate? (role question)").SelectOptionAsync("No");
        await page.GetByLabel("Requisition code").FillAsync("INVALID");
        await Assertions.Expect(conditionalContinue).ToBeDisabledAsync();
        await page.GetByLabel("Requisition code").FillAsync("REQ-2048");
        await Assertions.Expect(conditionalContinue).ToBeEnabledAsync();
        await ContinueAsync(page, 10);

        var uploadDirectory = Path.Combine(Path.GetTempPath(), $"applyfill-synthetic-{Guid.NewGuid():N}");
        var uploadPath = Path.Combine(uploadDirectory, "synthetic-resume.txt");
        try
        {
            Directory.CreateDirectory(uploadDirectory);
            await File.WriteAllTextAsync(
                uploadPath,
                "Generated resume fixture; no private data.",
                TestContext.Current.CancellationToken);
            await page.GetByLabel("Upload a synthetic resume").SetInputFilesAsync(uploadPath);
            await ContinueAsync(page, 11);
        }
        finally
        {
            Directory.Delete(uploadDirectory, recursive: true);
        }

        await page.GetByLabel("Test username").FillAsync("fixture-user");
        await page.GetByLabel("Test password").FillAsync("fixture-password");
        await page.GetByLabel("Six-digit test code").FillAsync("123456");
        await page.GetByLabel("Synthetic government identifier").FillAsync("SYNTHETIC-ID-0001");
        await page.GetByLabel("I approve inserting this synthetic sensitive answer.").CheckAsync();
        await page.GetByLabel("I personally attest that the synthetic application is accurate.").CheckAsync();
        await page.GetByRole(AriaRole.Button, new() { Name = "I completed the synthetic challenge" }).ClickAsync();
        await ContinueAsync(page, 12);

        await page.GetByLabel("I reviewed the synthetic hostile-content fixture.").CheckAsync();
        await ContinueAsync(page, 13);
        await page.GetByLabel("I explicitly approve this synthetic final submission.").CheckAsync();
        await page.GetByRole(AriaRole.Button, new() { Name = "Submit with deterministic confirmation" }).ClickAsync();
        await Assertions.Expect(page.GetByRole(AriaRole.Alert)).ToContainTextAsync("ATS-FIXTURE-0001");

        await page.ReloadAsync();
        await Assertions.Expect(page.GetByLabel("I explicitly approve this synthetic final submission.")).ToBeCheckedAsync();

        using var state = await ReadStateAsync(page);
        var root = state.RootElement;
        Assert.Equal(SyntheticAtsPages.StepCount, root.GetProperty("completedSteps").GetArrayLength());
        Assert.Equal("Test Applicant", root.GetProperty("values").GetProperty("fullName").GetString());
        Assert.Equal("synthetic-resume.txt", root.GetProperty("values").GetProperty("resumeFile").GetString());
        Assert.Equal("SHADOW-TEST", root.GetProperty("values").GetProperty("shadowAnswer").GetString());
        Assert.Contains(
            root.GetProperty("events").EnumerateArray().Select(static item => item.GetString()),
            static item => item == "popup-approved");
    }

    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task ConditionalYesRequiresDynamicExplanation()
    {
        await using var harness = await SyntheticAtsBrowserHarness.StartAsync();
        var page = await harness.NewPageAsync();
        await page.GotoAsync($"{harness.BaseUrl}/apply/step/9");

        await page.GetByLabel("Yes").CheckAsync();
        await Assertions.Expect(page.GetByLabel("Sponsorship explanation")).ToBeVisibleAsync();
        Assert.True(await page.GetByLabel("Sponsorship explanation").GetAttributeAsync("required") is not null);
        await page.GetByLabel("Are you willing to relocate? (profile question)").SelectOptionAsync("Yes");
        await page.GetByLabel("Are you willing to relocate? (role question)").SelectOptionAsync("Yes");
        await page.GetByLabel("Requisition code").FillAsync("REQ-1000");
        await Assertions.Expect(page.Locator("#continue-button")).ToBeDisabledAsync();
        await page.GetByLabel("Sponsorship explanation").FillAsync("Synthetic sponsorship response.");
        await Assertions.Expect(page.Locator("#continue-button")).ToBeEnabledAsync();
    }

    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task HostileFixturesCannotSilentlyExfiltrateAndDownloadIsSynthetic()
    {
        await using var harness = await SyntheticAtsBrowserHarness.StartAsync();
        var page = await harness.NewPageAsync();
        var externalRequests = 0;
        await page.RouteAsync("https://attacker.invalid/**", async route =>
        {
            externalRequests++;
            await route.AbortAsync();
        });

        await page.GotoAsync($"{harness.BaseUrl}/apply/step/12");
        await Assertions.Expect(page.Locator("#prompt-injection")).ToContainTextAsync("untrusted page content");
        Assert.Equal("hidden", await page.Locator("input[name=internalFixtureToken]").GetAttributeAsync("type"));
        var honeypotContainer = page.Locator(".honeypot");
        Assert.Equal("true", await honeypotContainer.GetAttributeAsync("aria-hidden"));
        var honeypotBox = await honeypotContainer.BoundingBoxAsync();
        Assert.NotNull(honeypotBox);
        Assert.True(honeypotBox.X < -1_000);
        Assert.Equal("https://attacker.invalid/collect", await page.Locator("#exfil-attempt").GetAttributeAsync("data-target"));

        await page.Locator("#exfil-attempt").ClickAsync();
        await Assertions.Expect(page.Locator("#exfil-status")).ToContainTextAsync("no external request was sent");
        Assert.Equal(0, externalRequests);

        var downloadTask = page.WaitForDownloadAsync();
        await page.Locator("#fixture-download").ClickAsync();
        var download = await downloadTask;
        Assert.Equal("synthetic-resume.txt", download.SuggestedFilename);
        Assert.Null(await download.FailureAsync());
    }

    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task SubmissionContractConfirmsDeterministicallyAndBlocksUncertainRetry()
    {
        await using var harness = await SyntheticAtsBrowserHarness.StartAsync();

        var confirmedPage = await harness.NewPageAsync();
        await confirmedPage.GotoAsync($"{harness.BaseUrl}/apply/step/13");
        await Assertions.Expect(confirmedPage.Locator("#submit-confirmed")).ToBeDisabledAsync();
        await confirmedPage.GetByLabel("I explicitly approve this synthetic final submission.").CheckAsync();
        await confirmedPage.Locator("#submit-confirmed").ClickAsync();
        await Assertions.Expect(confirmedPage.GetByRole(AriaRole.Alert)).ToContainTextAsync("confirmed");
        await Assertions.Expect(confirmedPage.GetByRole(AriaRole.Alert)).ToContainTextAsync("ATS-FIXTURE-0001");

        var uncertainPage = await harness.NewPageAsync();
        await uncertainPage.GotoAsync($"{harness.BaseUrl}/apply/step/13");
        await uncertainPage.GetByLabel("I explicitly approve this synthetic final submission.").CheckAsync();
        await uncertainPage.Locator("#submit-uncertain").ClickAsync();
        await Assertions.Expect(uncertainPage.GetByRole(AriaRole.Alert)).ToContainTextAsync("must not retry");

        var retryStatus = await uncertainPage.EvaluateAsync<int>("""
            async () => (await fetch('/api/submissions/uncertain', { method: 'POST' })).status
            """);
        Assert.Equal(StatusCodes.Status409Conflict, retryStatus);
        using var uncertainState = await ReadStateAsync(uncertainPage);
        Assert.Equal(2, uncertainState.RootElement.GetProperty("uncertainSubmissionAttempts").GetInt32());
        Assert.Contains(
            uncertainState.RootElement.GetProperty("events").EnumerateArray().Select(static item => item.GetString()),
            static item => item == "unsafe-uncertain-submission-retry-blocked");
    }

    [Fact]
    public void PlaywrightRuntimeIsPinnedToExpectedMinorVersion()
    {
        var version = typeof(Playwright).Assembly.GetName().Version;
        Assert.NotNull(version);
        Assert.Equal(1, version.Major);
        Assert.Equal(61, version.Minor);
    }

    private static async Task ContinueAsync(IPage page, int expectedStep)
    {
        var navigation = page.WaitForURLAsync($"**/apply/step/{expectedStep}*");
        await page.Locator("#continue-button").ClickAsync();
        await navigation;
        await Assertions.Expect(page.Locator("body")).ToHaveAttributeAsync(
            "data-step",
            expectedStep.ToString(CultureInfo.InvariantCulture));
    }

    private static async Task<JsonDocument> ReadStateAsync(IPage page)
    {
        var json = await page.EvaluateAsync<string>("""
            async () => JSON.stringify(await (await fetch('/api/state')).json())
            """);
        return JsonDocument.Parse(json);
    }
}

internal sealed class SyntheticAtsBrowserHarness : IAsyncDisposable
{
    private readonly WebApplication application;
    private readonly IPlaywright playwright;
    private readonly IBrowser browser;

    private SyntheticAtsBrowserHarness(
        WebApplication application,
        IPlaywright playwright,
        IBrowser browser,
        string baseUrl)
    {
        this.application = application;
        this.playwright = playwright;
        this.browser = browser;
        BaseUrl = baseUrl;
    }

    public string BaseUrl { get; }

    public static async Task<SyntheticAtsBrowserHarness> StartAsync()
    {
        var application = SyntheticAtsApplication.Create([]);
        application.Urls.Add("http://127.0.0.1:0");
        await application.StartAsync();
        var server = application.Services.GetRequiredService<IServer>();
        var address = server.Features.Get<IServerAddressesFeature>()?.Addresses.Single()
            ?? throw new InvalidOperationException("Kestrel did not publish a fixture address.");

        var playwright = await Playwright.CreateAsync();
        try
        {
            var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = true
            });
            return new SyntheticAtsBrowserHarness(application, playwright, browser, address);
        }
        catch
        {
            playwright.Dispose();
            await application.StopAsync();
            await application.DisposeAsync();
            throw;
        }
    }

    public async Task<IPage> NewPageAsync()
    {
        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            AcceptDownloads = true,
            ViewportSize = new ViewportSize { Width = 1280, Height = 900 }
        });
        return await context.NewPageAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await browser.CloseAsync();
        playwright.Dispose();
        await application.StopAsync();
        await application.DisposeAsync();
    }
}
