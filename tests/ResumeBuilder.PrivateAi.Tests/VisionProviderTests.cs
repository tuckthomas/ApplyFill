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

    [Theory]
    [InlineData("```json\n{\"pageType\":\"application\"}\n```")]
    [InlineData("Here is the requested result:\n{\"pageType\":\"application\"}\nEnd of result.")]
    public async Task ProviderAcceptsOneValidatedJsonValueWrappedByModelFormatting(string content)
    {
        var response = System.Text.Json.JsonSerializer.Serialize(new
        {
            choices = new[] { new { message = new { content } } },
        });
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
                [new ImageInput(new byte[] { 1 }, "image/png")],
                null,
                256),
            TestContext.Current.CancellationToken);

        Assert.Equal("{\"pageType\":\"application\"}", result.OutputJson);
    }

    [Fact]
    public async Task DocumentReaderSafelyWrapsPlainOcrText()
    {
        const string response = "{\"choices\":[{\"message\":{\"content\":\"WORK EXPERIENCE\\nSenior Analyst\"}}]}";
        using var client = new HttpClient(new StaticResponseHandler(response));
        var provider = new LlamaCppVisionProvider(
            client,
            new Uri("http://127.0.0.1:43210/"),
            "model",
            "revision",
            "secret");

        var result = await provider.InferAsync(
            new VisionInferenceRequest(
                "document-page-parsing",
                "1",
                "1",
                "Read the document.",
                [new ImageInput(new byte[] { 1 }, "image/jpeg")],
                null,
                256),
            TestContext.Current.CancellationToken);

        using var output = System.Text.Json.JsonDocument.Parse(result.OutputJson);
        Assert.Contains("Senior Analyst", output.RootElement.GetProperty("text").GetString(), StringComparison.Ordinal);
        Assert.Equal(0, output.RootElement.GetProperty("blocks").GetArrayLength());
    }

    [Fact]
    public async Task ProviderSendsApprovedJsonSchemaToLlamaCpp()
    {
        const string response = "{\"choices\":[{\"message\":{\"content\":\"{\\\"education\\\":[],\\\"experience\\\":[],\\\"projects\\\":[],\\\"skills\\\":[]}\"}}]}";
        var handler = new RecordingResponseHandler(response);
        using var client = new HttpClient(handler);
        var provider = new LlamaCppVisionProvider(
            client,
            new Uri("http://127.0.0.1:43210/"),
            "model",
            "revision",
            "secret");

        await provider.InferAsync(
            new VisionInferenceRequest(
                "resume-profile-proposal",
                "1",
                "1",
                "Read the resume.",
                [new ImageInput(new byte[] { 1 }, "image/png")],
                null,
                256,
                """
                {
                  "type": "object",
                  "properties": {
                    "education": { "type": "array" },
                    "experience": { "type": "array" },
                    "projects": { "type": "array" },
                    "skills": { "type": "array" }
                  },
                  "required": ["education", "experience", "projects", "skills"]
                }
                """),
            TestContext.Current.CancellationToken);

        using var payload = System.Text.Json.JsonDocument.Parse(handler.RequestBody!);
        Assert.False(
            payload.RootElement.GetProperty("chat_template_kwargs").GetProperty("enable_thinking").GetBoolean());
        var responseFormat = payload.RootElement.GetProperty("response_format");
        Assert.Equal("json_object", responseFormat.GetProperty("type").GetString());
        Assert.Equal(
            4,
            responseFormat.GetProperty("schema").GetProperty("required").GetArrayLength());
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

    private sealed class RecordingResponseHandler(string response) : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(response, Encoding.UTF8, "application/json"),
            };
        }
    }
}
