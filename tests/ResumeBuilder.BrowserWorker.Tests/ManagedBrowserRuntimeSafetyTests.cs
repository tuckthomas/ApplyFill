using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Runtime;
using ResumeBuilder.BrowserWorker.Security;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class ManagedBrowserRuntimeSafetyTests
{
    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task SpaAndPopupChangesInvalidateHandlesAndStopRemovesTemporaryBrowserData()
    {
        await using var server = new LocalApplicationServer();
        var root = Path.Combine(Path.GetTempPath(), "ApplyFill.Tests", Guid.NewGuid().ToString("N"));
        var profileRoot = Path.Combine(root, "profiles");
        var downloadRoot = Path.Combine(root, "downloads");
        var leases = new ControlLeaseManager();
        await using var runtime = CreateRuntime(leases, profileRoot, downloadRoot);
        var session = await runtime.StartAsync(Guid.NewGuid(), StartRequest(server.StartUri), CancellationToken.None);
        var lease = leases.Get(session.SessionId);

        var first = await runtime.ObserveAsync(session.SessionId, "local-owner", CancellationToken.None);
        var oldField = first.Controls.Single(control => control.Label == "Old field");
        var continueButton = first.Controls.Single(control => control.Label == "Continue");
        var navigation = await runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.Click, first.PageGeneration, Handle: continueButton.Handle),
            null,
            CancellationToken.None);

        Assert.Equal(BrowserActionOutcome.NavigationStarted, navigation.Outcome);
        var staleAfterSpa = await runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.Type, first.PageGeneration, Handle: oldField.Handle, Value: "must-not-appear"),
            null,
            CancellationToken.None);
        Assert.Equal(BrowserActionOutcome.StaleObservation, staleAfterSpa.Outcome);

        var second = await runtime.ObserveAsync(session.SessionId, "local-owner", CancellationToken.None);
        var download = second.Controls.Single(control => control.Label == "Download file");
        var downloadResult = await runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.Click, second.PageGeneration, Handle: download.Handle),
            null,
            CancellationToken.None);
        Assert.Equal(BrowserActionOutcome.Succeeded, downloadResult.Outcome);

        var popup = second.Controls.Single(control => control.Label == "Open review");
        var popupResult = await runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.OpenTab, second.PageGeneration, TargetUri: new Uri(server.StartUri, "/popup")),
            null,
            CancellationToken.None);
        Assert.Equal(BrowserActionOutcome.NavigationStarted, popupResult.Outcome);

        var staleAfterPopup = await runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.Click, second.PageGeneration, Handle: popup.Handle),
            null,
            CancellationToken.None);
        Assert.Equal(BrowserActionOutcome.StaleObservation, staleAfterPopup.Outcome);

        await runtime.StopAsync(session.SessionId, "local-owner", CancellationToken.None);

        Assert.False(Directory.Exists(Path.Combine(profileRoot, session.SessionId.ToString("N"))));
        Assert.False(Directory.Exists(Path.Combine(downloadRoot, session.SessionId.ToString("N"))));
        if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
    }

    [Fact]
    [Trait("Category", "BrowserIntegration")]
    public async Task QueuedAgentCommandIsRejectedWhenUserTakesControlBeforeBrowserGateOpens()
    {
        await using var server = new LocalApplicationServer();
        var root = Path.Combine(Path.GetTempPath(), "ApplyFill.Tests", Guid.NewGuid().ToString("N"));
        var leases = new ControlLeaseManager();
        await using var runtime = CreateRuntime(leases, Path.Combine(root, "profiles"), Path.Combine(root, "downloads"));
        var session = await runtime.StartAsync(Guid.NewGuid(), StartRequest(server.StartUri), CancellationToken.None);
        var observation = await runtime.ObserveAsync(session.SessionId, "local-owner", CancellationToken.None);
        var button = observation.Controls.Single(control => control.Label == "Continue");
        var lease = leases.Get(session.SessionId);

        var blocker = runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.Wait, observation.PageGeneration, Delay: TimeSpan.FromMilliseconds(200)),
            null,
            CancellationToken.None);
        var queued = runtime.ExecuteAsync(
            session.SessionId,
            "local-owner",
            lease.Epoch,
            new BrowserAction(BrowserActionKind.Click, observation.PageGeneration, Handle: button.Handle),
            null,
            CancellationToken.None);

        leases.TakeUserControl(session.SessionId);

        Assert.Equal(BrowserActionOutcome.UserInterrupted, (await blocker).Outcome);
        var queuedResult = await queued;
        Assert.Equal(BrowserActionOutcome.UserInterrupted, queuedResult.Outcome);
        Assert.Equal("control-transferred", queuedResult.Code);
        var unchanged = await runtime.GetAsync(session.SessionId, "local-owner", CancellationToken.None);
        Assert.NotNull(unchanged);
        Assert.Equal("/start", unchanged.CurrentUri.AbsolutePath);

        await runtime.StopAsync(session.SessionId, "local-owner", CancellationToken.None);
        if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
    }

    private static PlaywrightBrowserRuntime CreateRuntime(
        ControlLeaseManager leases,
        string profileRoot,
        string downloadRoot) => new(
        leases,
        new BrowserActionPolicy(),
        Options.Create(new BrowserRuntimeOptions
        {
            AllowHttpForDevelopment = true,
            Headless = true,
            MaxConcurrentSessions = 1,
            ProfileRoot = profileRoot,
            DownloadRoot = downloadRoot,
        }),
        NullLogger<PlaywrightBrowserRuntime>.Instance);

    private static BrowserSessionStart StartRequest(Uri uri) => new(
        uri,
        "local-owner",
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "localhost" });

    private sealed class LocalApplicationServer : IAsyncDisposable
    {
        private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
        private readonly CancellationTokenSource _cancellation = new();
        private readonly Task _loop;

        public LocalApplicationServer()
        {
            _listener.Start();
            var port = ((IPEndPoint)_listener.LocalEndpoint).Port;
            StartUri = new Uri($"http://localhost:{port}/start");
            _loop = ServeAsync();
        }

        public Uri StartUri { get; }

        private async Task ServeAsync()
        {
            try
            {
                while (!_cancellation.IsCancellationRequested)
                {
                    var client = await _listener.AcceptTcpClientAsync(_cancellation.Token);
                    try
                    {
                        await RespondAsync(client, _cancellation.Token);
                    }
                    catch (IOException)
                    {
                        client.Dispose();
                    }
                    catch (SocketException)
                    {
                        client.Dispose();
                    }
                }
            }
            catch (OperationCanceledException) when (_cancellation.IsCancellationRequested) { }
            catch (SocketException) when (_cancellation.IsCancellationRequested) { }
        }

        private static async Task RespondAsync(TcpClient client, CancellationToken cancellationToken)
        {
            using (client)
            await using (var stream = client.GetStream())
            {
                using var reader = new StreamReader(stream, Encoding.ASCII, leaveOpen: true);
                var requestLine = await reader.ReadLineAsync(cancellationToken);
                string? line;
                do
                {
                    line = await reader.ReadLineAsync(cancellationToken);
                } while (!string.IsNullOrEmpty(line));

                var path = requestLine?.Split(' ', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(1) ?? "/";
                var (status, contentType, extraHeaders, body) = Response(path);
                var bytes = Encoding.UTF8.GetBytes(body);
                var headers = Encoding.ASCII.GetBytes(
                    $"HTTP/1.1 {status}\r\nContent-Type: {contentType}\r\nContent-Length: {bytes.Length}\r\nConnection: close\r\n{extraHeaders}\r\n");
                await stream.WriteAsync(headers, cancellationToken);
                await stream.WriteAsync(bytes, cancellationToken);
            }
        }

        private static (string Status, string ContentType, string ExtraHeaders, string Body) Response(string path) => path switch
        {
            "/start" or "/step2" => (
                "200 OK",
                "text/html; charset=utf-8",
                string.Empty,
                """
                <!doctype html><html><body>
                  <label>Old field <input aria-label="Old field"></label>
                  <button type="button" onclick="history.pushState({}, '', '/step2'); document.querySelector('[aria-label=&quot;Old field&quot;]').remove()">Continue</button>
                  <button type="button" onclick="window.open('/popup', '_blank')">Open review</button>
                  <a href="/file" download="blocked.txt" role="button">Download file</a>
                </body></html>
                """),
            "/popup" => ("200 OK", "text/html; charset=utf-8", string.Empty, "<!doctype html><html><body><h1>Review</h1></body></html>"),
            "/file" => ("200 OK", "text/plain", "Content-Disposition: attachment; filename=blocked.txt\r\n", "blocked download"),
            _ => ("404 Not Found", "text/plain", string.Empty, "not found"),
        };

        public async ValueTask DisposeAsync()
        {
            _cancellation.Cancel();
            _listener.Stop();
            await _loop;
            _cancellation.Dispose();
        }
    }
}
