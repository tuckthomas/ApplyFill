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
