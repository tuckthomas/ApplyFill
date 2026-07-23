using System.Net;
using System.Security.Cryptography;
using ResumeBuilder.PrivateAi.Catalog;
using ResumeBuilder.PrivateAi.Installation;

namespace ResumeBuilder.PrivateAi.Tests;

public sealed class ArtifactInstallerTests
{
    [Fact]
    public async Task DownloadIsVerifiedBeforeItBecomesInstalled()
    {
        var bytes = "verified-private-ai"u8.ToArray();
        using var httpClient = new HttpClient(new StaticContentHandler(bytes));
        using var directory = new TemporaryDirectory();
        var installer = new ArtifactInstaller(httpClient, directory.Path);
        var artifact = new PrivateAiArtifact(
            "model",
            "model.gguf",
            bytes.Length,
            Convert.ToHexStringLower(SHA256.HashData(bytes)),
            new Uri("https://models.invalid/model.gguf"));

        var path = await installer.InstallAsync(
            "model",
            "revision",
            artifact,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(bytes, await File.ReadAllBytesAsync(path, TestContext.Current.CancellationToken));
        Assert.False(File.Exists(path + ".partial"));
    }

    [Fact]
    public async Task LargeArtifactUsesResumableParallelRanges()
    {
        var bytes = Enumerable.Range(0, 256 * 1024).Select(index => (byte)(index % 251)).ToArray();
        var handler = new RangeContentHandler(bytes);
        using var httpClient = new HttpClient(handler);
        using var directory = new TemporaryDirectory();
        var installer = new ArtifactInstaller(httpClient, directory.Path, parallelThresholdBytes: 1, maximumParallelSegments: 4);
        var artifact = new PrivateAiArtifact(
            "model",
            "model.gguf",
            bytes.Length,
            Convert.ToHexStringLower(SHA256.HashData(bytes)),
            new Uri("https://models.invalid/model.gguf"));

        var path = await installer.InstallAsync(
            "model",
            "revision",
            artifact,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(bytes, await File.ReadAllBytesAsync(path, TestContext.Current.CancellationToken));
        Assert.Equal(2, handler.RangeRequests);
        Assert.Empty(Directory.EnumerateFiles(directory.Path, "*.segment", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task HashMismatchFailsClosedAndRemovesPartialArtifact()
    {
        var bytes = "tampered"u8.ToArray();
        using var httpClient = new HttpClient(new StaticContentHandler(bytes));
        using var directory = new TemporaryDirectory();
        var installer = new ArtifactInstaller(httpClient, directory.Path);
        var artifact = new PrivateAiArtifact(
            "model",
            "model.gguf",
            bytes.Length,
            new string('0', 64),
            new Uri("https://models.invalid/model.gguf"));

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            installer.InstallAsync(
                "model",
                "revision",
                artifact,
                cancellationToken: TestContext.Current.CancellationToken));
        Assert.Empty(Directory.EnumerateFiles(directory.Path, "*.partial", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task ArtifactPathCannotEscapeInstallationRoot()
    {
        using var httpClient = new HttpClient(new StaticContentHandler([1]));
        using var directory = new TemporaryDirectory();
        var installer = new ArtifactInstaller(httpClient, directory.Path);
        var artifact = new PrivateAiArtifact(
            "model",
            "../escape.gguf",
            1,
            new string('0', 64),
            new Uri("https://models.invalid/model.gguf"));

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            installer.InstallAsync(
                "model",
                "revision",
                artifact,
                cancellationToken: TestContext.Current.CancellationToken));
    }

    private sealed class StaticContentHandler(byte[] content) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(content),
            });
    }

    private sealed class RangeContentHandler(byte[] content) : HttpMessageHandler
    {
        private int _rangeRequests;

        public int RangeRequests => _rangeRequests;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var range = Assert.Single(request.Headers.Range!.Ranges);
            var start = range.From!.Value;
            var end = range.To!.Value;
            Interlocked.Increment(ref _rangeRequests);
            var body = content[(int)start..checked((int)end + 1)];
            var response = new HttpResponseMessage(HttpStatusCode.PartialContent)
            {
                Content = new ByteArrayContent(body),
            };
            response.Content.Headers.ContentRange = new System.Net.Http.Headers.ContentRangeHeaderValue(start, end, content.Length);
            return Task.FromResult(response);
        }
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"applyfill-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose() => Directory.Delete(Path, true);
    }
}
