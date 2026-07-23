using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Domain.JobApplications;
using ResumeBuilder.Domain.Profiles;
using ResumeBuilder.Domain.Resumes;
using ResumeBuilder.Infrastructure.Persistence;

namespace ResumeBuilder.Tests;

[Collection(PostgreSqlTestGroup.Name)]
public sealed class RepositoryOwnershipAndPaginationTests(PostgreSqlFixture fixture)
{
    [Fact]
    public async Task AggregateQueriesRemainOwnerScopedWhilePagingAndFiltering()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var ownerId = Guid.CreateVersion7();
        var otherOwnerId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;

        await using var dbContext = fixture.CreateContext();
        var profiles = new EfProfileRepository(dbContext);
        var resumes = new EfResumeRepository(dbContext);
        var artifacts = new EfResumeArtifactRepository(dbContext);
        var applications = new EfJobApplicationRepository(dbContext);
        var runs = new EfApplicationRunRepository(dbContext);

        var profile = CreateProfile(ownerId, now);
        var otherProfile = CreateProfile(otherOwnerId, now);
        await profiles.SaveAsync(profile, null, cancellationToken);
        await profiles.SaveAsync(otherProfile, null, cancellationToken);

        var firstResume = CreateResume(ownerId, "First", now.AddMinutes(1));
        var secondResume = CreateResume(ownerId, "Second", now.AddMinutes(2));
        var thirdResume = CreateResume(ownerId, "Third", now.AddMinutes(3));
        var otherResume = CreateResume(otherOwnerId, "Other", now.AddMinutes(4));
        foreach (var resume in new[] { firstResume, secondResume, thirdResume, otherResume })
        {
            await resumes.SaveAsync(resume, null, cancellationToken);
        }

        var preparingApplication = CreateJobApplication(
            ownerId,
            JobApplicationStatus.Preparing,
            now.AddMinutes(1));
        var appliedApplication = CreateJobApplication(
            ownerId,
            JobApplicationStatus.Applied,
            now.AddMinutes(2));
        var otherApplication = CreateJobApplication(
            otherOwnerId,
            JobApplicationStatus.Applied,
            now.AddMinutes(3));
        foreach (var application in new[] { preparingApplication, appliedApplication, otherApplication })
        {
            await applications.SaveAsync(application, null, cancellationToken);
        }

        var completedRun = CreateRun(
            ownerId,
            appliedApplication.Id,
            profile.Id,
            secondResume.Id,
            ApplicationRunStatus.Completed,
            now.AddMinutes(2));
        var pausedRun = CreateRun(
            ownerId,
            preparingApplication.Id,
            profile.Id,
            firstResume.Id,
            ApplicationRunStatus.Paused,
            now.AddMinutes(3));
        var otherRun = CreateRun(
            otherOwnerId,
            otherApplication.Id,
            otherProfile.Id,
            otherResume.Id,
            ApplicationRunStatus.Completed,
            now.AddMinutes(4));
        foreach (var run in new[] { completedRun, pausedRun, otherRun })
        {
            await runs.SaveAsync(run, null, cancellationToken);
        }

        var artifact = new ResumeArtifact(
            Guid.CreateVersion7(),
            ownerId,
            secondResume.Id,
            "resume.pdf",
            "application/pdf",
            128,
            new string('A', 64),
            "owner/resume.pdf",
            now.AddMinutes(4));
        await artifacts.AddAsync(artifact, cancellationToken);
        await runs.AppendCheckpointAsync(
            CreateCheckpoint(ownerId, pausedRun.Id, 0, now.AddMinutes(4)),
            cancellationToken);
        await runs.AppendCheckpointAsync(
            CreateCheckpoint(ownerId, pausedRun.Id, 1, now.AddMinutes(5)),
            cancellationToken);

        Assert.Null(await profiles.FindAsync(otherOwnerId, profile.Id, cancellationToken));
        Assert.Null(await resumes.FindAsync(otherOwnerId, secondResume.Id, cancellationToken));
        Assert.Null(await applications.FindAsync(otherOwnerId, appliedApplication.Id, cancellationToken));
        Assert.Null(await runs.FindAsync(otherOwnerId, pausedRun.Id, cancellationToken));
        Assert.Null(await artifacts.FindAsync(otherOwnerId, secondResume.Id, artifact.Id, cancellationToken));
        Assert.Empty(await runs.ListCheckpointsAsync(otherOwnerId, pausedRun.Id, -1, 10, cancellationToken));

        var resumePage = await resumes.ListAsync(ownerId, 1, 1, cancellationToken);
        Assert.Single(resumePage);
        Assert.Equal(secondResume.Id, resumePage[0].Id);

        var appliedPage = await applications.ListAsync(
            ownerId,
            JobApplicationStatus.Applied,
            0,
            1,
            cancellationToken);
        Assert.Single(appliedPage);
        Assert.Equal(appliedApplication.Id, appliedPage[0].Id);

        var completedPage = await runs.ListAsync(
            ownerId,
            ApplicationRunStatus.Completed,
            0,
            1,
            cancellationToken);
        Assert.Single(completedPage);
        Assert.Equal(completedRun.Id, completedPage[0].Id);

        var checkpointPage = await runs.ListCheckpointsAsync(ownerId, pausedRun.Id, 0, 1, cancellationToken);
        Assert.Single(checkpointPage);
        Assert.Equal(1, checkpointPage[0].Sequence);

        Assert.Null(await artifacts.DeleteAsync(otherOwnerId, secondResume.Id, artifact.Id, cancellationToken));
        Assert.NotNull(await artifacts.FindAsync(ownerId, secondResume.Id, artifact.Id, cancellationToken));
    }

    private static Profile CreateProfile(Guid ownerId, DateTimeOffset now) => new(
        Guid.CreateVersion7(),
        ownerId,
        1,
        "{\"schemaVersion\":1}",
        null,
        Guid.CreateVersion7(),
        now,
        now);

    private static Resume CreateResume(Guid ownerId, string name, DateTimeOffset now) => new(
        Guid.CreateVersion7(),
        ownerId,
        name,
        1,
        "{\"schemaVersion\":1}",
        Guid.CreateVersion7(),
        now,
        now);

    private static JobApplication CreateJobApplication(
        Guid ownerId,
        JobApplicationStatus status,
        DateTimeOffset now) => new(
            Guid.CreateVersion7(),
            ownerId,
            "Example Company",
            "Example Role",
            new Uri("https://jobs.example.test/apply"),
            status,
            "{}",
            Guid.CreateVersion7(),
            now,
            now);

    private static ApplicationRun CreateRun(
        Guid ownerId,
        Guid jobApplicationId,
        Guid profileId,
        Guid resumeId,
        ApplicationRunStatus status,
        DateTimeOffset now) => new(
            Guid.CreateVersion7(),
            ownerId,
            jobApplicationId,
            profileId,
            resumeId,
            new Uri("https://jobs.example.test/apply"),
            status,
            status.ToString(),
            ControlOwner.Agent,
            0,
            null,
            Guid.CreateVersion7(),
            now,
            now);

    private static RunCheckpoint CreateCheckpoint(
        Guid ownerId,
        Guid runId,
        long sequence,
        DateTimeOffset now) => new(
            Guid.CreateVersion7(),
            ownerId,
            runId,
            sequence,
            ApplicationRunStatus.Observing,
            "Observing",
            "https://jobs.example.test/apply",
            "jobs.example.test",
            "{}",
            now);
}
