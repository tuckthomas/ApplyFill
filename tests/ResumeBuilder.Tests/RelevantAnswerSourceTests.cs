using Microsoft.AspNetCore.DataProtection;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Profiles;
using ResumeBuilder.Domain.Profiles;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Tests;

public sealed class RelevantAnswerSourceTests
{
    [Fact]
    public async Task ReturnsOnlyMatchedOrdinaryValuesAndMaskedSensitiveCandidates()
    {
        var ownerId = Guid.CreateVersion7();
        var profileId = Guid.CreateVersion7();
        var protector = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        var now = DateTimeOffset.UtcNow;
        var profile = new Profile(
            profileId,
            ownerId,
            1,
            "{\"personal\":{\"firstName\":\"Tucker\",\"phone\":\"+1 (317) 555-0123\"}}",
            protector.Protect("{\"socialSecurityNumber\":\"123456789\"}"),
            Guid.CreateVersion7(),
            now,
            now);
        var source = new ProfileRelevantAnswerSource(new SingleProfileRepository(profile), protector);
        var controls = new[]
        {
            new VisibleFormControl("first", "First name", "textbox", "given-name", null),
            new VisibleFormControl("ssn", "Social security number", "textbox", null, null),
            new VisibleFormControl("unrelated", "Favorite ice cream", "textbox", null, null),
        };

        var result = await source.FindCandidatesAsync(
            ownerId,
            new RelevantAnswerQuery(profileId, controls),
            TestContext.Current.CancellationToken);

        var ordinary = Assert.Single(result, x => x.ControlId == "first");
        Assert.Equal("Tucker", ordinary.Value);
        Assert.False(ordinary.IsSensitive);
        var sensitive = Assert.Single(result, x => x.ControlId == "ssn");
        Assert.Null(sensitive.Value);
        Assert.Equal("••••6789", sensitive.MaskedValue);
        Assert.True(sensitive.RequiresApproval);
        Assert.DoesNotContain(result, x => x.ControlId == "unrelated");
    }

    private sealed class SingleProfileRepository(Profile profile) : IProfileRepository
    {
        public Task<Profile?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Profile?>(ownerId == profile.OwnerId && id == profile.Id ? profile : null);

        public Task<Profile?> FindCurrentAsync(Guid ownerId, CancellationToken cancellationToken) =>
            Task.FromResult<Profile?>(ownerId == profile.OwnerId ? profile : null);

        public Task SaveAsync(Profile value, Guid? expectedToken, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
