using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class ApiRunCheckpointStoreTests
{
    [Fact]
    public async Task StartAndCheckpointUseProtectedStableCommandsWithoutPageValues()
    {
        var runId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var trackerId = Guid.NewGuid();
        var firstToken = Guid.NewGuid();
        var secondToken = Guid.NewGuid();
        var call = 0;
        var requests = new List<CapturedRequest>();
        var handler = new StubHandler(request =>
        {
            requests.Add(Capture(request));
            return Interlocked.Increment(ref call) switch
            {
                1 => Json(Projection(runId, trackerId, profileId, firstToken, 0, "Created")),
                2 => Json(Projection(runId, trackerId, profileId, secondToken, 1, "Observing")),
                _ => throw new InvalidOperationException("Unexpected request."),
            };
        });
        var store = CreateStore(handler);
        var target = new Uri("https://jobs.example.test/apply");

        var started = await store.StartOrGetAsync(
            new WorkerRunStart(runId, profileId, null, null, target),
            CancellationToken.None);
        store.AttachBrowserSession(runId, Guid.NewGuid());
        await store.AppendAsync(new Checkpoint(
            Guid.NewGuid(), runId, 1, RunState.Observing, "Contact", target, 2,
            "Type", "Social Security number", "verified", ControlOwner.Agent,
            DateTimeOffset.UtcNow, false, false), CancellationToken.None);

        Assert.Equal(trackerId, started.JobApplicationId);
        Assert.Equal(2, requests.Count);
        Assert.All(requests, request =>
        {
            Assert.Equal("worker-token-that-is-long-enough-for-tests", request.WorkerToken);
            Assert.Equal("1", request.LocalRequest);
            Assert.NotEmpty(request.IdempotencyKey);
        });
        Assert.Equal($"run-start:{runId:N}", requests[0].IdempotencyKey);
        Assert.Equal($"run-checkpoint:{runId:N}:1", requests[1].IdempotencyKey);
        Assert.DoesNotContain("Social Security number", requests[1].Body, StringComparison.Ordinal);
        Assert.DoesNotContain("value", requests[1].Body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, (await store.GetLatestAsync(runId, CancellationToken.None))?.Sequence);
    }

    [Fact]
    public async Task RecoverableProjectionCarriesDurableCheckpointSequence()
    {
        var runId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var handler = new StubHandler(_ => Json($$"""[{{Projection(runId, Guid.NewGuid(), profileId, Guid.NewGuid(), 7, "Paused")}}]"""));
        var store = CreateStore(handler);

        var runs = await store.ListRecoverableAsync(10, CancellationToken.None);
        var latest = await store.GetLatestAsync(runId, CancellationToken.None);

        Assert.Equal(7, Assert.Single(runs).LastCheckpointSequence);
        Assert.Equal(7, latest?.Sequence);
    }

    [Fact]
    public async Task ConcurrentLocalCheckpointsAreSerializedAndRebasedWithoutAGap()
    {
        var runId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var trackerId = Guid.NewGuid();
        var call = 0;
        var handler = new StubHandler(_ =>
        {
            var current = Interlocked.Increment(ref call);
            return Json(Projection(
                runId,
                trackerId,
                profileId,
                Guid.NewGuid(),
                Math.Max(0, current - 1),
                current == 1 ? "Created" : "Observing"));
        });
        var store = CreateStore(handler);
        var target = new Uri("https://jobs.example.test/apply");
        await store.StartOrGetAsync(new WorkerRunStart(runId, profileId, null, null, target), CancellationToken.None);
        var first = Checkpoint(runId, target, "Click");
        var second = Checkpoint(runId, target, "Type");

        await Task.WhenAll(
            store.AppendAsync(first, CancellationToken.None),
            store.AppendAsync(second, CancellationToken.None));

        Assert.Equal([1L, 2L], (await store.GetActivityAsync(runId, CancellationToken.None)).Select(value => value.Sequence));
    }

    private static ApiRunCheckpointStore CreateStore(HttpMessageHandler handler)
    {
        var options = Options.Create(new ApplyFillApiOptions
        {
            BaseUri = new Uri("http://127.0.0.1:5180"),
            WorkerToken = "worker-token-that-is-long-enough-for-tests",
        });
        return new ApiRunCheckpointStore(
            new HttpClient(handler) { BaseAddress = options.Value.BaseUri },
            options);
    }

    private static Checkpoint Checkpoint(Guid runId, Uri target, string intent) => new(
        Guid.NewGuid(), runId, 1, RunState.Observing, "Application step", target, 2,
        intent, "Form field", "verified", ControlOwner.Agent, DateTimeOffset.UtcNow, false, false);

    private static CapturedRequest Capture(HttpRequestMessage request) => new(
        request.Headers.GetValues("X-ApplyFill-Worker-Token").Single(),
        request.Headers.GetValues("X-ApplyFill-Request").Single(),
        request.Headers.GetValues("Idempotency-Key").Single(),
        request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty);

    private static string Projection(
        Guid runId,
        Guid trackerId,
        Guid profileId,
        Guid token,
        long sequence,
        string status) => $$"""
        {"runId":"{{runId}}","jobApplicationId":"{{trackerId}}","profileId":"{{profileId}}","resumeId":null,"targetUrl":"https://jobs.example.test/apply","status":{{StatusNumber(status)}},"stage":"Contact","controlOwner":0,"retryCount":0,"lastCheckpointSequence":{{sequence}},"concurrencyToken":"{{token}}","createdAt":"2026-07-22T00:00:00Z","updatedAt":"2026-07-22T00:01:00Z"}
        """;

    private static int StatusNumber(string status) => status switch
    {
        "Created" => 0,
        "Observing" => 3,
        "Paused" => 7,
        _ => throw new ArgumentOutOfRangeException(nameof(status)),
    };

    private static HttpResponseMessage Json(string content) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(content, Encoding.UTF8, "application/json"),
    };

    private sealed record CapturedRequest(string WorkerToken, string LocalRequest, string IdempotencyKey, string Body);

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> handle) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(handle(request));
    }
}
