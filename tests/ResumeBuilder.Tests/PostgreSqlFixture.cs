using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

namespace ResumeBuilder.Tests;

public sealed class PostgreSqlFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder(
        "postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296")
        .WithDatabase("applyfill_tests")
        .WithUsername("applyfill_tests")
        .WithPassword("applyfill-tests-only-password")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync();
        await using var dbContext = CreateContext();
        await dbContext.Database.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();

    public ApplyFillDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplyFillDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        return new ApplyFillDbContext(options);
    }
}

[CollectionDefinition(Name)]
public sealed class PostgreSqlTestGroup : ICollectionFixture<PostgreSqlFixture>
{
    public const string Name = "PostgreSQL 18";
}
