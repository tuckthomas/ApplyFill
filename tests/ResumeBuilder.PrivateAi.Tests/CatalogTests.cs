using ResumeBuilder.PrivateAi.Catalog;

namespace ResumeBuilder.PrivateAi.Tests;

public sealed class CatalogTests
{
    [Fact]
    public async Task QualitySelectionUsesEightBModelOnBaselineHardware()
    {
        var catalog = await PrivateAiCatalog.LoadAsync(
            Path.Combine(AppContext.BaseDirectory, "catalog"),
            TestContext.Current.CancellationToken);

        var model = catalog.ResolveModel(
            ["page-understanding", "gui-grounding", "structured-actions"],
            new PrivateAiHardware("win-x64", 32L * 1024 * 1024 * 1024, 8L * 1024 * 1024 * 1024));

        Assert.Equal("qwen3-vl-8b-instruct-q4", model.Id);
        Assert.Equal("f982a07559d4a2f6c8744d840bf6fccab30eea96", model.Revision);
    }

    [Fact]
    public async Task QualitySelectionFallsBackToFourBWhenVideoMemoryIsBounded()
    {
        var catalog = await PrivateAiCatalog.LoadAsync(
            Path.Combine(AppContext.BaseDirectory, "catalog"),
            TestContext.Current.CancellationToken);

        var model = catalog.ResolveModel(
            ["page-understanding", "gui-grounding", "structured-actions"],
            new PrivateAiHardware("win-x64", 20L * 1024 * 1024 * 1024, 4L * 1024 * 1024 * 1024));

        Assert.Equal("qwen3-vl-4b-instruct-q4", model.Id);
    }

    [Fact]
    public async Task ResolverRejectsUnsupportedHardware()
    {
        var catalog = await PrivateAiCatalog.LoadAsync(
            Path.Combine(AppContext.BaseDirectory, "catalog"),
            TestContext.Current.CancellationToken);

        Assert.Throws<PrivateAiUnavailableException>(() => catalog.ResolveModel(
            ["page-understanding"],
            new PrivateAiHardware("win-x64", 8L * 1024 * 1024 * 1024, 1024 * 1024 * 1024)));
    }
}
