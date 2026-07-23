using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Domain.Profiles;
using ResumeBuilder.Infrastructure.Persistence;

namespace ResumeBuilder.Tests;

[Collection(PostgreSqlTestGroup.Name)]
public sealed class PersistenceTests(PostgreSqlFixture fixture)
{
    [Fact]
    public async Task MigrationCreatesPostgreSql18Schema()
    {
        await using var dbContext = fixture.CreateContext();
        var migrations = await dbContext.Database.GetAppliedMigrationsAsync(TestContext.Current.CancellationToken);

        Assert.Contains(migrations, x => x.EndsWith("InitialPostgreSql18", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ProfileQueriesAreOwnerScoped()
    {
        var owner = Guid.CreateVersion7();
        var otherOwner = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        var profile = new Profile(
            Guid.CreateVersion7(),
            owner,
            1,
            "{\"schemaVersion\":1}",
            null,
            Guid.CreateVersion7(),
            now,
            now);

        await using var dbContext = fixture.CreateContext();
        var repository = new EfProfileRepository(dbContext);
        await repository.SaveAsync(profile, null, TestContext.Current.CancellationToken);

        var owned = await repository.FindAsync(owner, profile.Id, TestContext.Current.CancellationToken);
        var leaked = await repository.FindAsync(otherOwner, profile.Id, TestContext.Current.CancellationToken);

        Assert.NotNull(owned);
        Assert.Null(leaked);
    }

    [Fact]
    public async Task StaleProfileUpdateIsRejected()
    {
        var owner = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        var profile = new Profile(
            Guid.CreateVersion7(),
            owner,
            1,
            "{\"schemaVersion\":1}",
            null,
            Guid.CreateVersion7(),
            now,
            now);

        await using (var createContext = fixture.CreateContext())
        {
            await new EfProfileRepository(createContext).SaveAsync(
                profile,
                null,
                TestContext.Current.CancellationToken);
        }

        await using var firstContext = fixture.CreateContext();
        await using var secondContext = fixture.CreateContext();
        var firstRepository = new EfProfileRepository(firstContext);
        var secondRepository = new EfProfileRepository(secondContext);
        var first = await firstRepository.FindAsync(owner, profile.Id, TestContext.Current.CancellationToken);
        var second = await secondRepository.FindAsync(owner, profile.Id, TestContext.Current.CancellationToken);
        Assert.NotNull(first);
        Assert.NotNull(second);
        var originalToken = first.ConcurrencyToken;

        first.Update(1, "{\"schemaVersion\":1,\"first\":true}", null, now.AddMinutes(1));
        await firstRepository.SaveAsync(first, originalToken, TestContext.Current.CancellationToken);

        second.Update(1, "{\"schemaVersion\":1,\"second\":true}", null, now.AddMinutes(2));
        await Assert.ThrowsAsync<ConcurrencyConflictException>(async () =>
            await secondRepository.SaveAsync(second, originalToken, TestContext.Current.CancellationToken));
    }
}
