using System.Net;
using System.Text;
using ResumeBuilder.Application.Models;
using ResumeBuilder.PrivateAi.Runtime;

namespace ResumeBuilder.PrivateAi.Tests;

public sealed class VisionProviderTests
{
    [Fact]
    public async Task ProviderReturnsOnlyParsedStructuredJson()
    {
        const string response = "{\"choices\":[{\"message\":{\"content\":\"{\\\"pageType\\\":\\\"application\\\"}\"}}]}";
        using var client = new HttpClient(new StaticResponseHandler(response));
        var provider = new LlamaCppVisionProvider(
            client,
            new Uri("http://127.0.0.1:43210/"),
            "model",
            "revision",
            "secret");

        var result = await provider.InferAsync(
            new VisionInferenceRequest(
                "page-understanding",
                "1",
                "1",
                "Classify this page.",
                [new ImageInput(new byte[] { 1, 2, 3 }, "image/png")],
                null,
                256),
            TestContext.Current.CancellationToken);

        Assert.Equal("{\"pageType\":\"application\"}", result.OutputJson);
    }

    [Fact]
    public async Task ProviderRejectsMalformedModelOutput()
    {
        const string response = "{\"choices\":[{\"message\":{\"content\":\"not json\"}}]}";
        using var client = new HttpClient(new StaticResponseHandler(response));
        var provider = new LlamaCppVisionProvider(
            client,
            new Uri("http://127.0.0.1:43210/"),
            "model",
            "revision",
            "secret");

        await Assert.ThrowsAnyAsync<System.Text.Json.JsonException>(() => provider.InferAsync(
            new VisionInferenceRequest(
                "page-understanding",
                "1",
                "1",
                "Classify this page.",
                [new ImageInput(new byte[] { 1 }, "image/png")],
                null,
                256),
            TestContext.Current.CancellationToken));
    }

    [Fact]
    public void ProviderRefusesNonLoopbackEndpoint()
    {
        using var client = new HttpClient();

        Assert.Throws<ArgumentException>(() => new LlamaCppVisionProvider(
            client,
            new Uri("https://example.com/"),
            "model",
            "revision",
            "secret"));
    }

    private sealed class StaticResponseHandler(string response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(response, Encoding.UTF8, "application/json"),
        });
    }
}
