using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Api.Controllers;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Infrastructure.Persistence;

namespace ResumeBuilder.Tests;

[Collection(PostgreSqlTestGroup.Name)]
public sealed class UserSettingsTests(PostgreSqlFixture fixture)
{
    [Fact]
    public async Task MigrationCreatesOwnerScopedSettingsResourceWithOptimisticConcurrency()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var ownerId = Guid.CreateVersion7();
        var otherOwnerId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        var original = new UserSettingResource(
            Guid.CreateVersion7(),
            ownerId,
            "dashboard",
            1,
            "{\"widgets\":[]}",
            Guid.CreateVersion7(),
            now,
            now);

        await using var dbContext = fixture.CreateContext();
        var migrations = await dbContext.Database.GetAppliedMigrationsAsync(cancellationToken);
        Assert.Contains(migrations, value => value.EndsWith("AddUserSettingsResource", StringComparison.Ordinal));

        var repository = new EfUserSettingRepository(dbContext);
        await repository.SaveAsync(original, null, cancellationToken);

        Assert.NotNull(await repository.FindAsync(ownerId, "dashboard", cancellationToken));
        Assert.Null(await repository.FindAsync(otherOwnerId, "dashboard", cancellationToken));

        var updated = original with
        {
            ContentJson = "{\"widgets\":[{\"type\":\"text\",\"content\":\"Private note\"}]}",
            ConcurrencyToken = Guid.CreateVersion7(),
            UpdatedAt = now.AddMinutes(1),
        };
        await repository.SaveAsync(updated, original.ConcurrencyToken, cancellationToken);

        var stale = original with
        {
            ContentJson = "{\"widgets\":[]}",
            ConcurrencyToken = Guid.CreateVersion7(),
            UpdatedAt = now.AddMinutes(2),
        };
        await Assert.ThrowsAsync<ConcurrencyConflictException>(() =>
            repository.SaveAsync(stale, original.ConcurrencyToken, cancellationToken));

        var persisted = await repository.FindAsync(ownerId, "dashboard", cancellationToken);
        Assert.NotNull(persisted);
        using var persistedDocument = JsonDocument.Parse(persisted.ContentJson);
        Assert.Equal(
            "Private note",
            persistedDocument.RootElement.GetProperty("widgets")[0].GetProperty("content").GetString());
        Assert.Equal(updated.ConcurrencyToken, persisted?.ConcurrencyToken);
    }

    [Fact]
    public async Task ControllerCreatesReadsAndUpdatesReviewedResourcesWithEtags()
    {
        var repository = new InMemoryUserSettingRepository();
        var installation = new TestInstallation(Guid.CreateVersion7());
        var controller = CreateController(repository, installation);
        using var firstDocument = JsonDocument.Parse("{\"widgets\":[{\"type\":\"text\",\"content\":\"Remember this\"}]}");

        var createdResult = await controller.Put(
            "dashboard",
            new SaveUserSettingRequest(1, firstDocument.RootElement.Clone()),
            TestContext.Current.CancellationToken);
        var created = Assert.IsType<UserSettingResponse>(createdResult.Value);
        Assert.Equal("dashboard", created.Key);
        Assert.Equal(created.ConcurrencyToken, ParseEtag(controller.Response.Headers.ETag.ToString()));

        controller = CreateController(repository, installation);
        var getResult = await controller.Get("dashboard", TestContext.Current.CancellationToken);
        var found = Assert.IsType<UserSettingResponse>(getResult.Value);
        Assert.Equal("Remember this", found.Content.GetProperty("widgets")[0].GetProperty("content").GetString());
        Assert.Equal(created.ConcurrencyToken, ParseEtag(controller.Response.Headers.ETag.ToString()));

        controller = CreateController(repository, installation);
        controller.Request.Headers.IfMatch = $"\"{created.ConcurrencyToken:D}\"";
        using var updateDocument = JsonDocument.Parse("{\"widgets\":[]}");
        var updatedResult = await controller.Put(
            "dashboard",
            new SaveUserSettingRequest(2, updateDocument.RootElement.Clone()),
            TestContext.Current.CancellationToken);
        var updated = Assert.IsType<UserSettingResponse>(updatedResult.Value);
        Assert.Equal(2, updated.SchemaVersion);
        Assert.NotEqual(created.ConcurrencyToken, updated.ConcurrencyToken);
        Assert.Equal(updated.ConcurrencyToken, ParseEtag(controller.Response.Headers.ETag.ToString()));
    }

    [Fact]
    public async Task ControllerRejectsMissingUpdateTokenUnsupportedKeysAndOversizedDocuments()
    {
        var repository = new InMemoryUserSettingRepository();
        var installation = new TestInstallation(Guid.CreateVersion7());
        var controller = CreateController(repository, installation);
        using var document = JsonDocument.Parse("{\"value\":\"MM/dd/yyyy\"}");
        await controller.Put(
            "date-format",
            new SaveUserSettingRequest(1, document.RootElement.Clone()),
            TestContext.Current.CancellationToken);

        controller = CreateController(repository, installation);
        await Assert.ThrowsAsync<ArgumentException>(() => controller.Put(
            "date-format",
            new SaveUserSettingRequest(1, document.RootElement.Clone()),
            TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<ArgumentException>(() => controller.Get(
            "unreviewed-key",
            TestContext.Current.CancellationToken));

        var values = Enumerable.Repeat(new string('x', 32_768), 9).ToArray();
        using var oversized = JsonDocument.Parse(JsonSerializer.Serialize(new { values }));
        await Assert.ThrowsAsync<StructuredDocumentException>(() => controller.Put(
            "dashboard",
            new SaveUserSettingRequest(1, oversized.RootElement.Clone()),
            TestContext.Current.CancellationToken));
    }

    private static SettingsController CreateController(
        IUserSettingRepository repository,
        ICurrentInstallation installation)
    {
        var controller = new SettingsController(
            repository,
            installation,
            new TestClock(DateTimeOffset.UtcNow),
            new TestIdentifiers());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        return controller;
    }

    private static Guid ParseEtag(string value) => Guid.Parse(value.Trim('"'));

    private sealed class TestInstallation(Guid id) : ICurrentInstallation
    {
        public Guid Id { get; } = id;
    }

    private sealed class TestClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; } = now;
    }

    private sealed class TestIdentifiers : IIdentifierGenerator
    {
        public Guid NewId() => Guid.CreateVersion7();
    }

    private sealed class InMemoryUserSettingRepository : IUserSettingRepository
    {
        private readonly Dictionary<(Guid OwnerId, string Key), UserSettingResource> _values = [];

        public Task<UserSettingResource?> FindAsync(
            Guid ownerId,
            string key,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _values.TryGetValue((ownerId, key), out var value);
            return Task.FromResult(value);
        }

        public Task SaveAsync(
            UserSettingResource resource,
            Guid? expectedToken,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (_values.TryGetValue((resource.OwnerId, resource.Key), out var current))
            {
                if (expectedToken != current.ConcurrencyToken)
                {
                    throw new ConcurrencyConflictException(nameof(UserSettingResource), resource.Id);
                }
            }
            else if (expectedToken is not null)
            {
                throw new ConcurrencyConflictException(nameof(UserSettingResource), resource.Id);
            }

            _values[(resource.OwnerId, resource.Key)] = resource;
            return Task.CompletedTask;
        }
    }
}
