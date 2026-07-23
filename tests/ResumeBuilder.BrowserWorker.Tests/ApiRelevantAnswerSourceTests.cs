using System.Collections.Immutable;
using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;
using ResumeBuilder.BrowserWorker.Orchestration;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class ApiRelevantAnswerSourceTests
{
    [Fact]
    public async Task ReturnsOnlyHighestConfidenceOrdinaryAnswerForEachVisibleControl()
    {
        var handler = new StubHandler(request =>
        {
            Assert.Equal("worker-token-that-is-long-enough-for-tests", request.Headers.GetValues("X-ApplyFill-Worker-Token").Single());
            Assert.Equal("1", request.Headers.GetValues("X-ApplyFill-Request").Single());
            Assert.NotEmpty(request.Headers.GetValues("Idempotency-Key").Single());
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """
                    {"candidates":[
                      {"controlId":"first-name","sourcePath":"profile.other","displayName":"Other","value":"Wrong","maskedValue":null,"isSensitive":false,"isApproved":false,"requiresApproval":false,"confidence":0.51},
                      {"controlId":"first-name","sourcePath":"profile.firstName","displayName":"First name","value":"Ada","maskedValue":null,"isSensitive":false,"isApproved":false,"requiresApproval":false,"confidence":0.99},
                      {"controlId":"ssn","sourcePath":"applicationData.ssn","displayName":"SSN","value":null,"maskedValue":"••••6789","isSensitive":true,"isApproved":false,"requiresApproval":true,"confidence":0.99}
                    ]}
                    """,
                    Encoding.UTF8,
                    "application/json"),
            };
        });
        var source = CreateSource(handler);
        var controls = new[]
        {
            Control("first-name", "First name"),
            Control("ssn", "Social Security number", sensitive: true),
        };

        var lookup = await source.GetForVisibleControlsAsync(Guid.NewGuid(), Guid.NewGuid(), controls, CancellationToken.None);

        var answer = Assert.Single(lookup.Answers);
        Assert.Equal("First name", answer.Field);
        Assert.Equal("Ada", answer.Value);
        Assert.False(answer.Sensitive);
    }

    [Fact]
    public async Task FailsClosedWhenTheProfileApiCannotBeReached()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("offline"));
        var source = CreateSource(handler);

        var lookup = await source.GetForVisibleControlsAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            [Control("email", "Email")],
            CancellationToken.None);

        Assert.Empty(lookup.Answers);
    }

    [Fact]
    public async Task SensitiveAnswerRequiresApprovalAndIsReleasedForOneExactControlOnce()
    {
        var call = 0;
        var bodies = new List<string>();
        var approvalId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var handler = new StubHandler(request =>
        {
            Assert.Equal("worker-token-that-is-long-enough-for-tests", request.Headers.GetValues("X-ApplyFill-Worker-Token").Single());
            Assert.Equal("1", request.Headers.GetValues("X-ApplyFill-Request").Single());
            Assert.NotEmpty(request.Headers.GetValues("Idempotency-Key").Single());
            bodies.Add(request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty);
            return Interlocked.Increment(ref call) switch
            {
                1 => Json("""
                    {"candidates":[{"controlId":"ssn","sourcePath":"applicationData.socialSecurityNumber","displayName":"Social Security number","value":null,"maskedValue":"••••6789","isSensitive":true,"isApproved":false,"requiresApproval":true,"confidence":0.99}]}
                    """),
                2 => Json($$"""
                    {"id":"{{approvalId}}","runId":"{{runId}}","controlId":"ssn","sourcePath":"applicationData.socialSecurityNumber","displayName":"Social Security number","maskedValue":"••••6789","state":0,"concurrencyToken":"{{Guid.NewGuid()}}","createdAt":"2026-07-22T00:00:00Z","expiresAt":"2026-07-22T01:00:00Z","decidedAt":null,"consumedAt":null}
                    """),
                3 => Json($$"""{"approvalId":"{{approvalId}}","controlId":"ssn","value":"123456789"}"""),
                4 or 5 => Json("""{"candidates":[]}"""),
                _ => throw new InvalidOperationException("Unexpected request."),
            };
        });
        var source = CreateSource(handler);
        var controls = new[] { Control("ssn", "Social Security number", sensitive: true) };

        var pending = await source.GetForVisibleControlsAsync(runId, Guid.NewGuid(), controls, CancellationToken.None);

        Assert.Empty(pending.Answers);
        Assert.Equal(approvalId, pending.PendingSensitiveApproval?.ApprovalId);
        Assert.Equal("••••6789", pending.PendingSensitiveApproval?.MaskedValue);
        Assert.True(await source.ConsumeApprovedAsync(runId, approvalId, "ssn", CancellationToken.None));

        var approved = await source.GetForVisibleControlsAsync(runId, Guid.NewGuid(), controls, CancellationToken.None);
        var answer = Assert.Single(approved.Answers);
        Assert.True(answer.Sensitive);
        Assert.True(answer.ApprovedForThisApplication);
        Assert.Equal("123456789", answer.Value);
        source.MarkUsed(runId, "ssn");
        var spent = await source.GetForVisibleControlsAsync(runId, Guid.NewGuid(), controls, CancellationToken.None);
        Assert.Empty(spent.Answers);
        Assert.DoesNotContain(bodies, body => body.Contains("123456789", StringComparison.Ordinal));
    }

    [Fact]
    public void RejectsNonLoopbackApiAddress()
    {
        var options = Options.Create(new ApplyFillApiOptions
        {
            BaseUri = new Uri("https://example.com"),
            WorkerToken = "worker-token-that-is-long-enough-for-tests",
        });

        Assert.Throws<InvalidOperationException>(() =>
            new ApiRelevantAnswerSource(new HttpClient(new StubHandler(_ => new HttpResponseMessage())), options));
    }

    private static ApiRelevantAnswerSource CreateSource(HttpMessageHandler handler)
    {
        var options = Options.Create(new ApplyFillApiOptions
        {
            BaseUri = new Uri("http://127.0.0.1:5180"),
            WorkerToken = "worker-token-that-is-long-enough-for-tests",
        });
        return new ApiRelevantAnswerSource(new HttpClient(handler) { BaseAddress = options.Value.BaseUri }, options);
    }

    private static HttpResponseMessage Json(string content) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(content, Encoding.UTF8, "application/json"),
    };

    private static VisibleControl Control(string handle, string label, bool sensitive = false) => new(
        handle,
        "textbox",
        label,
        "text",
        Required: true,
        Enabled: true,
        Checked: false,
        Sensitive: sensitive,
        CurrentValue: null,
        ImmutableArray<string>.Empty);

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> handle) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(handle(request));
    }
}
