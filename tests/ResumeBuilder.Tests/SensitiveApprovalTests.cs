using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Profiles;
using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Tests;

[Collection(PostgreSqlTestGroup.Name)]
public sealed class SensitiveApprovalTests(PostgreSqlFixture fixture)
{
    [Fact]
    public async Task ExactSensitiveValueCanBeConsumedOnlyOnceAfterRunScopedApproval()
    {
        var ownerId = Guid.CreateVersion7();
        var profileId = Guid.CreateVersion7();
        var runId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        var protector = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        await using var dbContext = fixture.CreateContext();
        dbContext.Profiles.Add(new ProfileRecord
        {
            Id = profileId,
            OwnerId = ownerId,
            SchemaVersion = 1,
            ContentJson = "{\"personal\":{\"firstName\":\"Tucker\"}}",
            ProtectedApplicationData = protector.Protect("{\"socialSecurityNumber\":\"123456789\"}"),
            ConcurrencyToken = Guid.CreateVersion7(),
            CreatedAt = now,
            UpdatedAt = now,
        });
        dbContext.ApplicationRuns.Add(new ApplicationRunRecord
        {
            Id = runId,
            OwnerId = ownerId,
            JobApplicationId = Guid.CreateVersion7(),
            ProfileId = profileId,
            TargetUrl = "https://jobs.example.test/apply",
            Status = ApplicationRunStatus.AwaitingUser,
            Stage = "Sensitive answer approval",
            ControlOwner = ControlOwner.User,
            ConcurrencyToken = Guid.CreateVersion7(),
            CreatedAt = now,
            UpdatedAt = now,
        });
        await dbContext.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new SensitiveAnswerApprovalService(
            dbContext,
            protector,
            new FixedClock(now),
            new TestIdentifiers());

        var requested = await service.RequestAsync(
            ownerId,
            new SensitiveApprovalRequest(
                runId,
                profileId,
                "control-ssn",
                "applicationData.socialSecurityNumber",
                "Social security number"),
            TestContext.Current.CancellationToken);

        Assert.Equal("••••6789", requested.MaskedValue);
        Assert.Equal(SensitiveApprovalState.Pending, requested.State);
        Assert.DoesNotContain("123456789", string.Join('|',
            requested.SourcePath,
            requested.DisplayName,
            requested.MaskedValue), StringComparison.Ordinal);

        var decided = await service.DecideAsync(
            ownerId,
            runId,
            requested.Id,
            requested.ConcurrencyToken,
            approved: true,
            TestContext.Current.CancellationToken);
        Assert.Equal(SensitiveApprovalState.Approved, decided?.State);

        var first = await service.ConsumeAsync(
            ownerId,
            runId,
            requested.Id,
            "control-ssn",
            TestContext.Current.CancellationToken);
        var replay = await service.ConsumeAsync(
            ownerId,
            runId,
            requested.Id,
            "control-ssn",
            TestContext.Current.CancellationToken);

        Assert.Equal("123456789", first?.Value);
        Assert.Null(replay);
        var stored = await dbContext.SensitiveAnswerApprovals.FindAsync(
            [requested.Id],
            TestContext.Current.CancellationToken);
        Assert.NotNull(stored);
        Assert.Equal(SensitiveApprovalState.Consumed, stored.State);
        Assert.DoesNotContain("123456789", stored.MaskedValue, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DeniedSensitiveValueCannotBeConsumed()
    {
        var ownerId = Guid.CreateVersion7();
        var profileId = Guid.CreateVersion7();
        var runId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        var protector = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        await using var dbContext = fixture.CreateContext();
        AddProfileAndRun(dbContext, protector, ownerId, profileId, runId, now);
        await dbContext.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new SensitiveAnswerApprovalService(
            dbContext,
            protector,
            new FixedClock(now),
            new TestIdentifiers());
        var requested = await service.RequestAsync(
            ownerId,
            new SensitiveApprovalRequest(
                runId,
                profileId,
                "control-ssn",
                "applicationData.socialSecurityNumber",
                "Social security number"),
            TestContext.Current.CancellationToken);

        var denied = await service.DecideAsync(
            ownerId,
            runId,
            requested.Id,
            requested.ConcurrencyToken,
            approved: false,
            TestContext.Current.CancellationToken);
        var consumed = await service.ConsumeAsync(
            ownerId,
            runId,
            requested.Id,
            "control-ssn",
            TestContext.Current.CancellationToken);

        Assert.Equal(SensitiveApprovalState.Denied, denied?.State);
        Assert.Null(consumed);
        Assert.DoesNotContain("123456789", denied!.MaskedValue, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MissingProtectedAnswerDoesNotCreateApproval()
    {
        var ownerId = Guid.CreateVersion7();
        var profileId = Guid.CreateVersion7();
        var runId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        var protector = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        await using var dbContext = fixture.CreateContext();
        AddProfileAndRun(dbContext, protector, ownerId, profileId, runId, now);
        await dbContext.SaveChangesAsync(TestContext.Current.CancellationToken);
        var service = new SensitiveAnswerApprovalService(
            dbContext,
            protector,
            new FixedClock(now),
            new TestIdentifiers());

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.RequestAsync(
            ownerId,
            new SensitiveApprovalRequest(
                runId,
                profileId,
                "control-passport",
                "applicationData.passportNumber",
                "Passport number"),
            TestContext.Current.CancellationToken));

        Assert.False(await dbContext.SensitiveAnswerApprovals.AnyAsync(
            item => item.OwnerId == ownerId && item.RunId == runId,
            TestContext.Current.CancellationToken));
    }

    private static void AddProfileAndRun(
        ApplyFillDbContext dbContext,
        DataProtectionSensitiveValueProtector protector,
        Guid ownerId,
        Guid profileId,
        Guid runId,
        DateTimeOffset now)
    {
        dbContext.Profiles.Add(new ProfileRecord
        {
            Id = profileId,
            OwnerId = ownerId,
            SchemaVersion = 1,
            ContentJson = "{\"personal\":{\"firstName\":\"Tucker\"}}",
            ProtectedApplicationData = protector.Protect("{\"socialSecurityNumber\":\"123456789\"}"),
            ConcurrencyToken = Guid.CreateVersion7(),
            CreatedAt = now,
            UpdatedAt = now,
        });
        dbContext.ApplicationRuns.Add(new ApplicationRunRecord
        {
            Id = runId,
            OwnerId = ownerId,
            JobApplicationId = Guid.CreateVersion7(),
            ProfileId = profileId,
            TargetUrl = "https://jobs.example.test/apply",
            Status = ApplicationRunStatus.AwaitingUser,
            Stage = "Sensitive answer approval",
            ControlOwner = ControlOwner.User,
            ConcurrencyToken = Guid.CreateVersion7(),
            CreatedAt = now,
            UpdatedAt = now,
        });
    }

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; } = now;
    }

    private sealed class TestIdentifiers : IIdentifierGenerator
    {
        public Guid NewId() => Guid.CreateVersion7();
    }
}
