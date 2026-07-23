using System.Collections.Concurrent;
using System.Collections.Immutable;
using Microsoft.Extensions.Options;
using Microsoft.Playwright;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Security;

namespace ResumeBuilder.BrowserWorker.Runtime;

public sealed partial class PlaywrightBrowserRuntime : IManagedBrowserRuntime
{
    private sealed class Session : IAsyncDisposable
    {
        public required Guid Id { get; init; }
        public required Guid RunId { get; init; }
        public required string OwnerId { get; init; }
        public required DateTimeOffset StartedAt { get; init; }
        public required IBrowserContext Context { get; init; }
        public required IPage ActivePage { get; set; }
        public required string ProfilePath { get; init; }
        public required string DownloadPath { get; init; }
        public required bool RetainProfile { get; init; }
        public required DomainGraph DomainGraph { get; init; }
        public required int Width { get; set; }
        public required int Height { get; set; }
        public required float DeviceScaleFactor { get; init; }
        public readonly SemaphoreSlim Gate = new(1, 1);
        public readonly ConcurrentDictionary<string, IElementHandle> Handles = new(StringComparer.Ordinal);
        public long PageGeneration = 1;
        public long FrameSequence;
        public long LastAcknowledgedFrame;
        public string LastKnownUrl = "about:blank";
        public BrowserRuntimeFailureKind? Failure;
        public bool Connected = true;

        public async ValueTask DisposeAsync()
        {
            Connected = false;
            try
            {
                await Context.CloseAsync();
            }
            catch (PlaywrightException)
            {
                // A crashed/disconnected browser is already closed. Cleanup must continue.
            }
            finally
            {
                Gate.Dispose();
            }

            await DeleteDirectoryAsync(DownloadPath);
            if (!RetainProfile)
            {
                await DeleteDirectoryAsync(ProfilePath);
            }
        }

        private static async Task DeleteDirectoryAsync(string path)
        {
            for (var attempt = 0; attempt < 3 && Directory.Exists(path); attempt++)
            {
                try
                {
                    Directory.Delete(path, recursive: true);
                    return;
                }
                catch (IOException) when (attempt < 2)
                {
                    await Task.Delay(50 * (attempt + 1));
                }
                catch (UnauthorizedAccessException) when (attempt < 2)
                {
                    await Task.Delay(50 * (attempt + 1));
                }
            }
        }
    }

    private sealed class StaleBrowserHandleException : Exception { }

    private readonly ConcurrentDictionary<Guid, Session> _sessions = new();
    private readonly SemaphoreSlim _sessionSlots;
    private readonly ControlLeaseManager _leases;
    private readonly BrowserActionPolicy _policy;
    private readonly BrowserRuntimeOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<PlaywrightBrowserRuntime> _logger;
    private IPlaywright? _playwright;
    private readonly SemaphoreSlim _playwrightGate = new(1, 1);

    public PlaywrightBrowserRuntime(
        ControlLeaseManager leases,
        BrowserActionPolicy policy,
        IOptions<BrowserRuntimeOptions> options,
        ILogger<PlaywrightBrowserRuntime> logger,
        TimeProvider? timeProvider = null)
    {
        _leases = leases;
        _policy = policy;
        _options = options.Value;
        _logger = logger;
        _timeProvider = timeProvider ?? TimeProvider.System;
        _sessionSlots = new SemaphoreSlim(_options.MaxConcurrentSessions, _options.MaxConcurrentSessions);
    }

    public async Task<BrowserSessionDescriptor> StartAsync(Guid runId, BrowserSessionStart request, CancellationToken cancellationToken)
    {
        ValidateStartRequest(request);
        if (!await _sessionSlots.WaitAsync(TimeSpan.Zero, cancellationToken))
            throw new InvalidOperationException("This computer is already running the maximum number of browser sessions.");

        var sessionId = Guid.NewGuid();
        var profileName = request.ReuseProfile
            ? SanitizeProfileId(request.ReusableProfileId ?? request.OwnerId)
            : sessionId.ToString("N");
        var profilePath = Path.GetFullPath(Path.Combine(_options.ProfileRoot, profileName));
        var rootPath = Path.GetFullPath(_options.ProfileRoot);
        if (!profilePath.StartsWith(rootPath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            _sessionSlots.Release();
            throw new InvalidOperationException("Browser profile path escaped its storage boundary.");
        }

        Directory.CreateDirectory(profilePath);
        var downloadPath = Path.GetFullPath(Path.Combine(_options.DownloadRoot, sessionId.ToString("N")));
        var downloadRoot = Path.GetFullPath(_options.DownloadRoot);
        if (!downloadPath.StartsWith(downloadRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            _sessionSlots.Release();
            throw new InvalidOperationException("Browser download path escaped its storage boundary.");
        }
        Directory.CreateDirectory(downloadPath);

        IBrowserContext? context = null;
        Session? session = null;
        try
        {
            var playwright = await GetPlaywrightAsync(cancellationToken);
            context = await playwright.Chromium.LaunchPersistentContextAsync(profilePath, new BrowserTypeLaunchPersistentContextOptions
            {
                Headless = _options.Headless,
                AcceptDownloads = false,
                DownloadsPath = downloadPath,
                ViewportSize = new ViewportSize { Width = request.ViewportWidth, Height = request.ViewportHeight },
                DeviceScaleFactor = request.DeviceScaleFactor,
                JavaScriptEnabled = true
            });

            var page = context.Pages.Count > 0 ? context.Pages[0] : await context.NewPageAsync();
            session = new Session
            {
                Id = sessionId,
                RunId = runId,
                OwnerId = request.OwnerId,
                StartedAt = _timeProvider.GetUtcNow(),
                Context = context,
                ActivePage = page,
                ProfilePath = profilePath,
                DownloadPath = downloadPath,
                RetainProfile = request.ReuseProfile,
                DomainGraph = new DomainGraph(request.ApprovedDomains),
                Width = request.ViewportWidth,
                Height = request.ViewportHeight,
                DeviceScaleFactor = request.DeviceScaleFactor,
                LastKnownUrl = page.Url
            };

            await context.RouteAsync("**/*", async route =>
            {
                var browserRequest = route.Request;
                if (!browserRequest.IsNavigationRequest || !Uri.TryCreate(browserRequest.Url, UriKind.Absolute, out var targetUri))
                {
                    await route.ContinueAsync();
                    return;
                }

                var currentUri = Uri.TryCreate(session.ActivePage.Url, UriKind.Absolute, out var current)
                    ? current
                    : request.StartUri;
                if (session.DomainGraph.Contains(targetUri) ||
                    session.DomainGraph.TryApproveTransition(currentUri, targetUri, _options.IdentityProviderHosts))
                    await route.ContinueAsync();
                else
                    await route.AbortAsync("blockedbyclient");
            });
            TrackContext(session);
            if (!_sessions.TryAdd(sessionId, session))
                throw new InvalidOperationException("Could not register the browser session.");

            _leases.AcquireAgent(sessionId);
            await page.GotoAsync(request.StartUri.AbsoluteUri, new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = 30_000 });
            return Descriptor(session);
        }
        catch
        {
            try
            {
                if (session is not null)
                {
                    _sessions.TryRemove(sessionId, out _);
                    _leases.Remove(sessionId);
                    try { await session.DisposeAsync(); }
                    catch (IOException) { }
                    catch (UnauthorizedAccessException) { }
                }
                else if (context is not null)
                {
                    try { await context.CloseAsync(); } catch (PlaywrightException) { }
                }
            }
            finally
            {
                _sessionSlots.Release();
                if (Directory.Exists(downloadPath))
                {
                    try { Directory.Delete(downloadPath, recursive: true); } catch { }
                }
                if (!request.ReuseProfile && Directory.Exists(profilePath))
                {
                    try { Directory.Delete(profilePath, recursive: true); } catch { }
                }
            }
            throw;
        }
    }

    public Task<BrowserSessionDescriptor?> GetAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(_sessions.TryGetValue(sessionId, out var session) && session.OwnerId == ownerId
            ? Descriptor(session)
            : null);
    }

    public async Task<ViewportFrame> CaptureFrameAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken)
    {
        var session = GetOwned(sessionId, ownerId);
        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            ThrowIfUnavailable(session);
            RefreshPageIdentity(session);
            var bytes = await session.ActivePage.ScreenshotAsync(new PageScreenshotOptions
            {
                Type = ScreenshotType.Jpeg,
                Quality = _options.ScreenshotQuality,
                Animations = ScreenshotAnimations.Disabled,
                Scale = ScreenshotScale.Css,
                Timeout = 10_000
            });
            var sequence = Interlocked.Increment(ref session.FrameSequence);
            session.LastAcknowledgedFrame = sequence;
            return new ViewportFrame(session.Id, sequence, session.PageGeneration, session.Width, session.Height,
                session.DeviceScaleFactor, _timeProvider.GetUtcNow(), bytes);
        }
        catch (PlaywrightException exception)
        {
            throw BrowserRuntimeFailureClassifier.Classify(exception, session.Failure);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task<PageObservation> ObserveAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken)
    {
        var session = GetOwned(sessionId, ownerId);
        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            ThrowIfUnavailable(session);
            RefreshPageIdentity(session);
            await ReleaseHandlesAsync(session);
            var controls = ImmutableArray.CreateBuilder<VisibleControl>();
            var labelsForInjectionCheck = new List<string?>();
            var inferenceMasks = new List<ILocator>();
            var frameIndex = 0;
            foreach (var frame in session.ActivePage.Frames)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var locator = frame.Locator("input:visible, textarea:visible, select:visible, button:visible, [role=button]:visible, [contenteditable=true]:visible");
                var count = Math.Min(await locator.CountAsync(), 300);
                for (var index = 0; index < count; index++)
                {
                    var candidate = locator.Nth(index);
                    var element = await candidate.ElementHandleAsync();
                    if (element is null) continue;
                    var handle = $"g{session.PageGeneration}-f{frameIndex}-c{index}";
                    var type = await candidate.GetAttributeAsync("type");
                    var role = await candidate.GetAttributeAsync("role") ?? InferRole(type, await candidate.EvaluateAsync<string>("element => element.tagName"));
                    var label = await GetAccessibleLabelAsync(candidate);
                    var sensitive = IsSensitive(type, label);
                    if (sensitive)
                    {
                        inferenceMasks.Add(candidate);
                    }
                    // Sensitive plaintext never leaves this method. A constant sentinel only
                    // records that the user/agent already populated the control, preventing a
                    // one-use approval from being requested again on the next observation.
                    var currentValue = sensitive
                        ? await HasProtectedInputValueAsync(candidate, type) ? "[protected]" : null
                        : await SafeInputValueAsync(candidate);
                    var options = role == "combobox" || type == "select-one"
                        ? (await candidate.Locator("option").AllTextContentsAsync()).Take(100).ToImmutableArray()
                        : [];

                    var visible = new VisibleControl(
                        handle,
                        role,
                        Truncate(label, 500),
                        type,
                        await HasBooleanAttributeAsync(candidate, "required"),
                        await candidate.IsEnabledAsync(),
                        await candidate.IsCheckedAsync(new LocatorIsCheckedOptions { Timeout = 1000 }).ContinueOnPlaywrightFailure(false),
                        sensitive,
                        Truncate(currentValue, 2_000),
                        options);
                    controls.Add(visible);
                    labelsForInjectionCheck.Add(visible.Label);
                    session.Handles[handle] = element;
                }
                frameIndex++;
            }

            var validation = (await session.ActivePage.Locator("[role=alert]:visible, [aria-invalid=true]:visible, .error:visible, .validation-error:visible")
                    .AllTextContentsAsync())
                .Select(value => Truncate(value, 500))
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.Ordinal)
                .Take(50)
                .Cast<string>()
                .ToImmutableArray();
            labelsForInjectionCheck.AddRange(validation);

            var title = Truncate(await session.ActivePage.TitleAsync(), 500) ?? string.Empty;
            var uri = new Uri(session.ActivePage.Url);
            var bodySample = Truncate(await session.ActivePage.Locator("body").InnerTextAsync(new LocatorInnerTextOptions { Timeout = 3000 }).ContinueOnPlaywrightFailure(string.Empty), 8_000) ?? string.Empty;
            var kind = ClassifyPage(uri, title, bodySample);
            var suspicious = PromptInjectionDetector.IsSuspicious(labelsForInjectionCheck.Append(bodySample));
            var screenshot = await session.ActivePage.ScreenshotAsync(new PageScreenshotOptions
            {
                Type = ScreenshotType.Jpeg,
                Quality = 60,
                Animations = ScreenshotAnimations.Disabled,
                Scale = ScreenshotScale.Css,
                Mask = inferenceMasks,
                MaskColor = "#111111"
            });

            return new PageObservation(1, session.Id, session.PageGeneration, uri, title, kind,
                controls.ToImmutable(), validation, screenshot, _timeProvider.GetUtcNow(), suspicious);
        }
        catch (PlaywrightException exception)
        {
            throw BrowserRuntimeFailureClassifier.Classify(exception, session.Failure);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task RelayInputAsync(Guid sessionId, string ownerId, long controlEpoch, BrowserInput input, CancellationToken cancellationToken)
    {
        var session = GetOwned(sessionId, ownerId);
        _leases.AssertOwner(sessionId, ControlOwner.User, controlEpoch);
        AssertInputCurrent(session, input);

        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            _leases.AssertOwner(sessionId, ControlOwner.User, controlEpoch);
            ThrowIfUnavailable(session);
            RefreshPageIdentity(session);
            AssertInputCurrent(session, input);
            var page = session.ActivePage;
            switch (input.Kind)
            {
                case BrowserInputKind.PointerMove:
                    await page.Mouse.MoveAsync((float)Required(input.X, "x"), (float)Required(input.Y, "y"));
                    break;
                case BrowserInputKind.PointerDown:
                    await page.Mouse.MoveAsync((float)Required(input.X, "x"), (float)Required(input.Y, "y"));
                    await page.Mouse.DownAsync(new MouseDownOptions { Button = ToMouseButton(input.Button) });
                    break;
                case BrowserInputKind.PointerUp:
                    await page.Mouse.MoveAsync((float)Required(input.X, "x"), (float)Required(input.Y, "y"));
                    await page.Mouse.UpAsync(new MouseUpOptions { Button = ToMouseButton(input.Button) });
                    break;
                case BrowserInputKind.Wheel:
                    await page.Mouse.MoveAsync((float)Required(input.X, "x"), (float)Required(input.Y, "y"));
                    await page.Mouse.WheelAsync((float)(input.DeltaX ?? 0), (float)(input.DeltaY ?? 0));
                    break;
                case BrowserInputKind.KeyDown:
                    await page.Keyboard.DownAsync(Required(input.Key, "key"));
                    break;
                case BrowserInputKind.KeyUp:
                    await page.Keyboard.UpAsync(Required(input.Key, "key"));
                    break;
                case BrowserInputKind.InsertText:
                case BrowserInputKind.Composition:
                    await page.Keyboard.InsertTextAsync(Required(input.Text, "text"));
                    break;
                case BrowserInputKind.Focus:
                    await page.BringToFrontAsync();
                    break;
                case BrowserInputKind.Resize:
                    var width = Math.Clamp(input.ViewportWidth ?? 0, 320, 3840);
                    var height = Math.Clamp(input.ViewportHeight ?? 0, 240, 2160);
                    await page.SetViewportSizeAsync(width, height);
                    session.Width = width;
                    session.Height = height;
                    break;
                default:
                    throw new InvalidOperationException("Unsupported browser input.");
            }
        }
        catch (PlaywrightException exception)
        {
            throw BrowserRuntimeFailureClassifier.Classify(exception, session.Failure);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task<BrowserActionResult> ExecuteAsync(Guid sessionId, string ownerId, long controlEpoch, BrowserAction action, ApprovedArtifact? artifact, CancellationToken cancellationToken)
    {
        var session = GetOwned(sessionId, ownerId);
        try
        {
            _leases.AssertOwner(sessionId, ControlOwner.Agent, controlEpoch);
        }
        catch (UnauthorizedAccessException)
        {
            return Result(BrowserActionOutcome.UserInterrupted, "control-transferred", "The user took control.", session.PageGeneration, false);
        }

        if (action.PageGeneration != session.PageGeneration)
            return Result(BrowserActionOutcome.StaleObservation, "stale-observation", "The page changed before the action ran.", session.PageGeneration, false);

        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            try
            {
                _leases.AssertOwner(sessionId, ControlOwner.Agent, controlEpoch);
            }
            catch (UnauthorizedAccessException)
            {
                return Result(BrowserActionOutcome.UserInterrupted, "control-transferred", "The user took control.", session.PageGeneration, false);
            }

            if (session.Failure is { } failure)
            {
                return FailureResult(failure, session.PageGeneration);
            }

            RefreshPageIdentity(session);
            if (action.PageGeneration != session.PageGeneration)
            {
                return Result(BrowserActionOutcome.StaleObservation, "stale-observation", "The page changed before the action ran.", session.PageGeneration, false);
            }

            var page = session.ActivePage;
            var beforeGeneration = session.PageGeneration;
            var beforePageCount = session.Context.Pages.Count;
            var verified = false;

            switch (action.Kind)
            {
                case BrowserActionKind.Navigate:
                case BrowserActionKind.OpenTab:
                    if (action.TargetUri is null || !session.DomainGraph.Contains(action.TargetUri))
                        return Result(BrowserActionOutcome.Blocked, "domain-not-approved", "Navigation is outside the approved application flow.", session.PageGeneration, false);
                    if (action.Kind == BrowserActionKind.OpenTab)
                    {
                        page = await session.Context.NewPageAsync();
                        session.ActivePage = page;
                    }
                    await page.GotoAsync(action.TargetUri.AbsoluteUri, new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = 30_000 });
                    return Result(BrowserActionOutcome.NavigationStarted, "navigation-started", "Navigation completed and requires a fresh observation.", session.PageGeneration, true);
                case BrowserActionKind.CloseTab:
                    if (session.Context.Pages.Count <= 1)
                        return Result(BrowserActionOutcome.Blocked, "last-tab", "The final application tab cannot be closed.", session.PageGeneration, false);
                    await page.CloseAsync();
                    var replacement = session.Context.Pages.LastOrDefault(candidate => !candidate.IsClosed);
                    if (replacement is null)
                        return FailureResult(BrowserRuntimeFailureKind.PageClosed, session.PageGeneration);
                    if (!ReferenceEquals(session.ActivePage, replacement))
                    {
                        session.ActivePage = replacement;
                        MarkPageChanged(session, replacement);
                    }
                    verified = true;
                    break;
                case BrowserActionKind.Focus:
                    var focusTarget = await GetHandleAsync(session, action);
                    await focusTarget.FocusAsync();
                    verified = await focusTarget.EvaluateAsync<bool>("element => element === document.activeElement");
                    break;
                case BrowserActionKind.Click:
                    await (await GetHandleAsync(session, action)).ClickAsync(new ElementHandleClickOptions { Timeout = 10_000 });
                    verified = true;
                    break;
                case BrowserActionKind.Type:
                    var typeTarget = await GetHandleAsync(session, action);
                    await typeTarget.FillAsync(action.Value ?? string.Empty);
                    verified = string.Equals(await typeTarget.InputValueAsync(), action.Value ?? string.Empty, StringComparison.Ordinal);
                    break;
                case BrowserActionKind.Select:
                    var selectTarget = await GetHandleAsync(session, action);
                    await selectTarget.SelectOptionAsync(action.Value ?? string.Empty);
                    verified = string.Equals(await selectTarget.InputValueAsync(), action.Value ?? string.Empty, StringComparison.Ordinal);
                    break;
                case BrowserActionKind.Check:
                    var checkTarget = await GetHandleAsync(session, action);
                    if (action.Checked == true) await checkTarget.CheckAsync();
                    else await checkTarget.UncheckAsync();
                    verified = await checkTarget.IsCheckedAsync() == action.Checked;
                    break;
                case BrowserActionKind.Scroll:
                    await page.Mouse.WheelAsync((float)(action.DeltaX ?? 0), (float)(action.DeltaY ?? 0));
                    verified = true;
                    break;
                case BrowserActionKind.UploadApprovedArtifact:
                    if (artifact is null || action.ArtifactId != artifact.Id)
                        return Result(BrowserActionOutcome.Blocked, "artifact-not-approved", "Upload artifact is not approved.", session.PageGeneration, false);
                    var uploadTarget = await GetHandleAsync(session, action);
                    await uploadTarget.SetInputFilesAsync(artifact.StagedPath);
                    verified = (await uploadTarget.InputValueAsync()).EndsWith(artifact.FileName, StringComparison.OrdinalIgnoreCase);
                    break;
                case BrowserActionKind.Wait:
                    await Task.Delay(action.Delay ?? TimeSpan.FromMilliseconds(250), cancellationToken);
                    verified = true;
                    break;
                default:
                    return Result(BrowserActionOutcome.Blocked, "unsupported-action", "Action is not supported.", session.PageGeneration, false);
            }

            if (session.Context.Pages.Count > beforePageCount && session.PageGeneration == beforeGeneration)
            {
                var popup = session.Context.Pages.LastOrDefault(candidate => !candidate.IsClosed);
                if (popup is not null)
                {
                    session.ActivePage = popup;
                    MarkPageChanged(session, popup);
                }
            }

            try
            {
                _leases.AssertOwner(sessionId, ControlOwner.Agent, controlEpoch);
            }
            catch (UnauthorizedAccessException)
            {
                return Result(BrowserActionOutcome.UserInterrupted, "control-transferred", "The user took control.", session.PageGeneration, false);
            }

            RefreshPageIdentity(session);
            if (session.PageGeneration != beforeGeneration)
                return Result(BrowserActionOutcome.NavigationStarted, "page-changed", "The page changed and requires a fresh observation.", session.PageGeneration, true);
            return verified
                ? Result(BrowserActionOutcome.Succeeded, "verified", "The action postcondition was verified.", session.PageGeneration, true)
                : Result(BrowserActionOutcome.ValidationFailed, "postcondition-failed", "The action did not produce the expected page state.", session.PageGeneration, false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return Result(BrowserActionOutcome.UserInterrupted, "cancelled", "The action was cancelled.", session.PageGeneration, false);
        }
        catch (StaleBrowserHandleException)
        {
            return Result(BrowserActionOutcome.StaleObservation, "stale-handle", "The application control changed before the action ran.", session.PageGeneration, false);
        }
        catch (PlaywrightException exception)
        {
            var classified = BrowserRuntimeFailureClassifier.Classify(exception, session.Failure);
            LogBrowserActionFailure(_logger, action.Kind, classified.Code);
            return Result(BrowserActionOutcome.BrowserError, classified.Code, classified.Message, session.PageGeneration, false);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task StopAsync(Guid sessionId, string ownerId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_sessions.TryGetValue(sessionId, out var owned) || owned.OwnerId != ownerId)
            throw new KeyNotFoundException("Browser session was not found.");
        if (_sessions.TryRemove(sessionId, out var session))
        {
            _leases.Remove(sessionId);
            try
            {
                await session.DisposeAsync();
            }
            finally
            {
                _sessionSlots.Release();
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var pair in _sessions.ToArray())
        {
            if (!_sessions.TryRemove(pair.Key, out var session)) continue;
            _leases.Remove(session.Id);
            try
            {
                await session.DisposeAsync();
            }
            finally
            {
                _sessionSlots.Release();
            }
        }
        _playwright?.Dispose();
        _sessionSlots.Dispose();
        _playwrightGate.Dispose();
    }

    private async Task<IPlaywright> GetPlaywrightAsync(CancellationToken cancellationToken)
    {
        if (_playwright is not null) return _playwright;
        await _playwrightGate.WaitAsync(cancellationToken);
        try { return _playwright ??= await Playwright.CreateAsync(); }
        finally { _playwrightGate.Release(); }
    }

    private static void TrackContext(Session session)
    {
        foreach (var page in session.Context.Pages) TrackPage(session, page);
        if (session.Context.Browser is { } browser)
        {
            browser.Disconnected += (_, _) => MarkFailed(session, BrowserRuntimeFailureKind.BrowserDisconnected);
        }
        session.Context.Page += (_, page) =>
        {
            session.ActivePage = page;
            TrackPage(session, page);
            MarkPageChanged(session, page);
        };
    }

    private static void TrackPage(Session session, IPage page)
    {
        page.Download += async (_, download) =>
        {
            try
            {
                await download.CancelAsync();
                await download.DeleteAsync();
            }
            catch (PlaywrightException)
            {
                // Session disposal removes the dedicated download directory.
            }
        };
        page.FrameNavigated += (_, frame) =>
        {
            if (ReferenceEquals(frame, page.MainFrame) && ReferenceEquals(session.ActivePage, page))
            {
                MarkPageChanged(session, page);
            }
        };
        page.Crash += (_, _) =>
        {
            if (ReferenceEquals(session.ActivePage, page))
            {
                MarkFailed(session, BrowserRuntimeFailureKind.PageCrashed);
            }
        };
        page.Close += (_, _) =>
        {
            if (!ReferenceEquals(session.ActivePage, page)) return;
            var replacement = session.Context.Pages.LastOrDefault(candidate => !candidate.IsClosed);
            if (replacement is null)
            {
                MarkFailed(session, BrowserRuntimeFailureKind.PageClosed);
                return;
            }

            session.ActivePage = replacement;
            MarkPageChanged(session, replacement);
        };
    }

    private Session GetOwned(Guid sessionId, string ownerId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session) || session.OwnerId != ownerId)
            throw new KeyNotFoundException("Browser session was not found.");
        return session;
    }

    private static BrowserSessionDescriptor Descriptor(Session session) =>
        new(session.Id, session.RunId, session.OwnerId, Uri.TryCreate(session.ActivePage.Url, UriKind.Absolute, out var uri) ? uri : new Uri("about:blank"),
            session.PageGeneration, ControlOwner.None, session.StartedAt, session.Connected);

    private BrowserActionResult Result(BrowserActionOutcome outcome, string code, string message, long generation, bool verified) =>
        new(outcome, code, message, generation, verified, _timeProvider.GetUtcNow());

    private BrowserActionResult FailureResult(BrowserRuntimeFailureKind failure, long generation) =>
        Result(BrowserActionOutcome.BrowserError, BrowserRuntimeFailureClassifier.Code(failure),
            BrowserRuntimeFailureClassifier.Message(failure), generation, false);

    private static async Task<IElementHandle> GetHandleAsync(Session session, BrowserAction action)
    {
        if (action.Handle is null || !session.Handles.TryGetValue(action.Handle, out var element))
        {
            throw new StaleBrowserHandleException();
        }

        try
        {
            if (!await element.EvaluateAsync<bool>("element => element.isConnected"))
            {
                throw new StaleBrowserHandleException();
            }
        }
        catch (PlaywrightException)
        {
            throw new StaleBrowserHandleException();
        }

        return element;
    }

    private static async Task ReleaseHandlesAsync(Session session)
    {
        var handles = session.Handles.Values.ToArray();
        session.Handles.Clear();
        foreach (var handle in handles)
        {
            try { await handle.DisposeAsync(); }
            catch (PlaywrightException) { }
        }
    }

    private static void AssertInputCurrent(Session session, BrowserInput input)
    {
        if (input.PageGeneration != session.PageGeneration ||
            input.FrameSequence <= 0 ||
            input.FrameSequence > session.LastAcknowledgedFrame)
        {
            throw new InvalidOperationException("The visible page changed before this input arrived.");
        }
    }

    private static void ThrowIfUnavailable(Session session)
    {
        if (session.Failure is { } failure)
        {
            throw new BrowserRuntimeException(failure, BrowserRuntimeFailureClassifier.Code(failure),
                BrowserRuntimeFailureClassifier.Message(failure));
        }
    }

    private static void RefreshPageIdentity(Session session)
    {
        var currentUrl = session.ActivePage.Url;
        if (string.Equals(currentUrl, session.LastKnownUrl, StringComparison.Ordinal)) return;
        MarkPageChanged(session, session.ActivePage);
    }

    private static void MarkPageChanged(Session session, IPage page)
    {
        session.LastKnownUrl = page.Url;
        Interlocked.Increment(ref session.PageGeneration);
        session.Handles.Clear();
    }

    private static void MarkFailed(Session session, BrowserRuntimeFailureKind failure)
    {
        session.Failure = failure;
        session.Connected = false;
        Interlocked.Increment(ref session.PageGeneration);
        session.Handles.Clear();
    }

    private void ValidateStartRequest(BrowserSessionStart request)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.OwnerId);
        if (request.ViewportWidth is < 320 or > 3840 || request.ViewportHeight is < 240 or > 2160)
            throw new ArgumentOutOfRangeException(nameof(request), "Viewport is outside supported bounds.");
        var graph = new DomainGraph(request.ApprovedDomains);
        if (!graph.Contains(request.StartUri))
            throw new InvalidOperationException("The start URL is outside the approved application domain graph.");
        if (!_options.AllowHttpForDevelopment && request.StartUri.Scheme != "https")
            throw new InvalidOperationException("Managed browser sessions require HTTPS.");
    }

    private static string SanitizeProfileId(string value)
    {
        var safe = new string(value.Where(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_').Take(80).ToArray());
        if (safe.Length == 0) throw new InvalidOperationException("Reusable browser profile ID is invalid.");
        return safe;
    }

    private static string InferRole(string? type, string tagName) => tagName.ToUpperInvariant() switch
    {
        "BUTTON" => "button",
        "SELECT" => "combobox",
        "TEXTAREA" => "textbox",
        "INPUT" when type is "checkbox" => "checkbox",
        "INPUT" when type is "radio" => "radio",
        "INPUT" => "textbox",
        _ => "control"
    };

    private static async Task<string?> GetAccessibleLabelAsync(ILocator locator)
    {
        var label = await locator.GetAttributeAsync("aria-label") ??
                    await locator.GetAttributeAsync("placeholder") ??
                    await locator.GetAttributeAsync("name") ??
                    await locator.GetAttributeAsync("title");
        if (!string.IsNullOrWhiteSpace(label)) return label;
        try { return await locator.InnerTextAsync(new LocatorInnerTextOptions { Timeout = 1000 }); }
        catch (PlaywrightException) { return null; }
    }

    private static async Task<bool> HasBooleanAttributeAsync(ILocator locator, string name) => await locator.GetAttributeAsync(name) is not null;

    private static async Task<string?> SafeInputValueAsync(ILocator locator)
    {
        try { return await locator.InputValueAsync(new LocatorInputValueOptions { Timeout = 1000 }); }
        catch (PlaywrightException) { return null; }
    }

    private static async Task<bool> HasProtectedInputValueAsync(ILocator locator, string? type)
    {
        try
        {
            if (type is "checkbox" or "radio")
            {
                return await locator.IsCheckedAsync(new LocatorIsCheckedOptions { Timeout = 1000 });
            }

            return !string.IsNullOrEmpty(await locator.InputValueAsync(new LocatorInputValueOptions { Timeout = 1000 }));
        }
        catch (PlaywrightException)
        {
            return false;
        }
    }

    private static bool IsSensitive(string? type, string? label)
    {
        if (type is "password" or "hidden") return true;
        var value = label?.ToLowerInvariant() ?? string.Empty;
        return value.Contains("password") || value.Contains("social security") || value.Contains("ssn") ||
               value.Contains("national id") || value.Contains("national insurance") || value.Contains("tax id") ||
               value.Contains("passport") || value.Contains("driver's license") || value.Contains("drivers license") ||
               value.Contains("verification code") || value.Contains("security code") || value.Contains("mfa") ||
               value.Contains("bank account") || value.Contains("routing number") || value.Contains("credit card") ||
               value.Contains("date of birth") || value.Contains("disability") || value.Contains("veteran") ||
               value.Contains("race") || value.Contains("ethnicity") || value.Contains("gender") ||
               value.Contains("work authorization") || value.Contains("visa sponsorship");
    }

    private static PageKind ClassifyPage(Uri uri, string title, string body)
    {
        var text = string.Join(' ', title, body).ToLowerInvariant();
        if (text.Contains("captcha") || text.Contains("verify you are human")) return PageKind.Captcha;
        if (text.Contains("multi-factor") || text.Contains("two-factor") || text.Contains("verification code")) return PageKind.Mfa;
        if (text.Contains("sign in") || text.Contains("log in") || uri.AbsolutePath.Contains("login", StringComparison.OrdinalIgnoreCase)) return PageKind.Login;
        if (text.Contains("application submitted") || text.Contains("thank you for applying")) return PageKind.Confirmation;
        if (text.Contains("review and submit") ||
            text.Contains("review your application") && text.Contains("submit")) return PageKind.Review;
        if (text.Contains("access denied") || text.Contains("something went wrong")) return PageKind.Error;
        return PageKind.ApplicationStep;
    }

    private static string? Truncate(string? value, int limit) => value is null || value.Length <= limit ? value : value[..limit];
    private static double Required(double? value, string name) => value ?? throw new InvalidOperationException($"Input {name} is required.");
    private static string Required(string? value, string name) => string.IsNullOrEmpty(value) ? throw new InvalidOperationException($"Input {name} is required.") : value;
    private static MouseButton ToMouseButton(int? value) => value switch { 1 => MouseButton.Middle, 2 => MouseButton.Right, _ => MouseButton.Left };

    [LoggerMessage(LogLevel.Warning, "Browser action {ActionKind} failed with code {FailureCode}.")]
    private static partial void LogBrowserActionFailure(ILogger logger, BrowserActionKind actionKind, string failureCode);
}

internal static class PlaywrightTaskExtensions
{
    public static async Task<T> ContinueOnPlaywrightFailure<T>(this Task<T> task, T fallback)
    {
        try { return await task; }
        catch (PlaywrightException) { return fallback; }
    }
}
