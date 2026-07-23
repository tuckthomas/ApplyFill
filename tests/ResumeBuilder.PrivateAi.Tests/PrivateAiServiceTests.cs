using Microsoft.Extensions.Options;
using ResumeBuilder.PrivateAi.Setup;

namespace ResumeBuilder.PrivateAi.Tests;

public sealed class PrivateAiServiceTests
{
    [Fact]
    public async Task InitializeReportsNotConfiguredWithoutDownloadingAnything()
    {
        using var directory = new TemporaryDirectory();
        await using var service = CreateService(directory.Path);

        var status = await service.InitializeAsync(TestContext.Current.CancellationToken);

        Assert.Equal(PrivateAiSetupState.NotConfigured, status.State);
        Assert.Equal("Private AI has not been set up.", status.Message);
        Assert.Empty(Directory.EnumerateFiles(directory.Path, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task RemovalRequiresAndHonorsApplyFillStorageMarker()
    {
        using var directory = new TemporaryDirectory();
        await File.WriteAllTextAsync(
            Path.Combine(directory.Path, ".applyfill-private-ai"),
            "ApplyFill Private AI storage v1",
            TestContext.Current.CancellationToken);
        await File.WriteAllTextAsync(
            Path.Combine(directory.Path, "artifact.bin"),
            "model",
            TestContext.Current.CancellationToken);
        await using var service = CreateService(directory.Path);

        await service.RemoveAsync(TestContext.Current.CancellationToken);

        Assert.False(Directory.Exists(directory.Path));
        directory.MarkRemoved();
    }

    private static PrivateAiService CreateService(string installationRoot) => new(Options.Create(new PrivateAiOptions
    {
        CatalogDirectory = Path.Combine(AppContext.BaseDirectory, "catalog"),
        InstallationRoot = installationRoot,
    }));

    private sealed class TemporaryDirectory : IDisposable
    {
        private bool _removed;

        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"applyfill-service-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void MarkRemoved() => _removed = true;

        public void Dispose()
        {
            if (!_removed && Directory.Exists(Path))
            {
                Directory.Delete(Path, true);
            }
        }
    }
}
