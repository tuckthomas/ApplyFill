using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ResumeBuilder.Tests;

public sealed class ApiSecurityTests : IClassFixture<ApplyFillApiFactory>
{
    private readonly HttpClient _client;

    public ApiSecurityTests(ApplyFillApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task StateChangingApiCallsRequireLocalProtectionHeaders()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/resumes",
            new { name = "Test", schemaVersion = 1, content = new { } },
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Contains("command-headers-required", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task LivenessDoesNotExposeUserContent()
    {
        var response = await _client.GetAsync("/health/live", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }
}

public sealed class ApplyFillApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Testing");
}
