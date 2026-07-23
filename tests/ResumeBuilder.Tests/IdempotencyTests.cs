using System.Text;
using Microsoft.AspNetCore.DataProtection;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Tests;

[Collection(PostgreSqlTestGroup.Name)]
public sealed class IdempotencyTests(PostgreSqlFixture fixture)
{
    [Fact]
    public async Task ConcurrentDuplicateWaitsAndReplaysProtectedResponse()
    {
        var ownerId = Guid.CreateVersion7();
        var key = Guid.CreateVersion7().ToString("D");
        const string requestHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        var dataProtection = new EphemeralDataProtectionProvider();
        var protector = new DataProtectionSensitiveValueProtector(dataProtection);
        await using var firstContext = fixture.CreateContext();
        await using var secondContext = fixture.CreateContext();
        var firstStore = CreateStore(firstContext, protector);
        var secondStore = CreateStore(secondContext, protector);

        var acquired = await firstStore.AcquireAsync(
            ownerId,
            key,
            "POST",
            "/api/v1/resumes",
            requestHash,
            TestContext.Current.CancellationToken);
        Assert.Equal(IdempotencyAcquireState.Acquired, acquired.State);

        var duplicate = secondStore.AcquireAsync(
            ownerId,
            key,
            "POST",
            "/api/v1/resumes",
            requestHash,
            TestContext.Current.CancellationToken);
        await Task.Delay(250, TestContext.Current.CancellationToken);
        var responseBody = Encoding.UTF8.GetBytes("{\"private\":\"response\"}");
        await firstStore.CompleteAsync(
            ownerId,
            key,
            requestHash,
            new IdempotencyReplay(201, "application/json", responseBody, "\"etag\"", "/resource/1"),
            TestContext.Current.CancellationToken);

        var replay = await duplicate;
        Assert.Equal(IdempotencyAcquireState.Replay, replay.State);
        Assert.Equal(responseBody, replay.Replay?.Body);
        Assert.Equal(201, replay.Replay?.StatusCode);

        var stored = await firstContext.ApiIdempotencyRecords.FindAsync(
            [firstContext.ApiIdempotencyRecords.Local.Single().Id],
            TestContext.Current.CancellationToken);
        Assert.NotNull(stored?.ProtectedResponseBody);
        Assert.DoesNotContain("response", stored.ProtectedResponseBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReusingAKeyForDifferentContentIsAConflict()
    {
        var ownerId = Guid.CreateVersion7();
        var key = Guid.CreateVersion7().ToString("D");
        var protector = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        await using var firstContext = fixture.CreateContext();
        await using var secondContext = fixture.CreateContext();
        var first = CreateStore(firstContext, protector);
        var second = CreateStore(secondContext, protector);

        await first.AcquireAsync(
            ownerId,
            key,
            "POST",
            "/api/v1/resumes",
            new string('a', 64),
            TestContext.Current.CancellationToken);
        var conflict = await second.AcquireAsync(
            ownerId,
            key,
            "POST",
            "/api/v1/resumes",
            new string('b', 64),
            TestContext.Current.CancellationToken);

        Assert.Equal(IdempotencyAcquireState.Conflict, conflict.State);
    }

    private static ApiIdempotencyStore CreateStore(
        ApplyFillDbContext dbContext,
        ISensitiveValueProtector protector) => new(
            dbContext,
            protector,
            new SystemClock(),
            new GuidIdentifierGenerator());
}
