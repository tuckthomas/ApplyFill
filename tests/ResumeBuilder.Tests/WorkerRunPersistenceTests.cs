using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Domain.JobApplications;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Tests;

[Collection(PostgreSqlTestGroup.Name)]
public sealed class WorkerRunPersistenceTests(PostgreSqlFixture fixture)
{
    [Fact]
    public async Task UntrackedTargetCreatesTrackerAndRunSurvivesNewContext()
    {
        var ownerId = Guid.CreateVersion7();
        var profileId = Guid.CreateVersion7();
        var runId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        await using (var setup = fixture.CreateContext())
        {
            setup.Profiles.Add(new ProfileRecord
            {
                Id = profileId,
                OwnerId = ownerId,
                SchemaVersion = 1,
                ContentJson = "{}",
                ConcurrencyToken = Guid.CreateVersion7(),
                CreatedAt = now,
                UpdatedAt = now,
            });
            await setup.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        PersistentRunProjection created;
        await using (var firstContext = fixture.CreateContext())
        {
            var service = CreateService(firstContext);
            created = await service.StartOrGetAsync(
                ownerId,
                new PersistWorkerRunRequest(
                    runId,
                    profileId,
                    null,
                    null,
                    "https://jobs.example.test/apply",
                    ApplicationRunStatus.Created,
                    "Created",
                    ControlOwner.Agent,
                    null),
                TestContext.Current.CancellationToken);
            using var summary = JsonDocument.Parse("{\"fieldsCompleted\":2}");
            created = Assert.IsType<PersistentRunProjection>(await service.UpdateAndCheckpointAsync(
                ownerId,
                runId,
                new PersistWorkerCheckpointRequest(
                    created.ConcurrencyToken,
                    1,
                    ApplicationRunStatus.Observing,
                    "Observing page",
                    ControlOwner.Agent,
                    0,
                    "browser-session-1",
                    "https://jobs.example.test/apply/step-2?candidate=secret#contact",
                    "jobs.example.test",
                    summary.RootElement.Clone()),
                TestContext.Current.CancellationToken));
        }

        await using var restartedContext = fixture.CreateContext();
        var restarted = CreateService(restartedContext);
        var recovered = await restarted.FindAsync(ownerId, runId, TestContext.Current.CancellationToken);
        var checkpoints = await restartedContext.RunCheckpoints.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && x.RunId == runId)
            .OrderBy(x => x.Sequence)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.NotNull(recovered);
        Assert.Equal(ApplicationRunStatus.Observing, recovered.Status);
        Assert.Equal(1, recovered.LastCheckpointSequence);
        Assert.Equal("https://jobs.example.test/apply/step-2", recovered.CurrentUrl);
        Assert.Equal("browser-session-1", recovered.BrowserSessionReference);
        Assert.NotEqual(Guid.Empty, recovered.JobApplicationId);
        Assert.Equal([0L, 1L], checkpoints.Select(x => x.Sequence));
        Assert.True(await restartedContext.JobApplications.AnyAsync(
            x => x.OwnerId == ownerId && x.Id == recovered.JobApplicationId,
            TestContext.Current.CancellationToken));

        using var completionSummary = JsonDocument.Parse("{\"confirmation\":true}");
        var completed = await restarted.UpdateAndCheckpointAsync(
            ownerId,
            runId,
            new PersistWorkerCheckpointRequest(
                recovered.ConcurrencyToken,
                2,
                ApplicationRunStatus.Completed,
                "Completed",
                ControlOwner.None,
                0,
                null,
                "https://jobs.example.test/application/confirmation",
                "jobs.example.test",
                completionSummary.RootElement.Clone()),
            TestContext.Current.CancellationToken);
        var trackerStatus = await restartedContext.JobApplications.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && x.Id == recovered.JobApplicationId)
            .Select(x => x.Status)
            .SingleAsync(TestContext.Current.CancellationToken);

        Assert.Equal(ApplicationRunStatus.Completed, completed?.Status);
        Assert.Equal(JobApplicationStatus.Applied, trackerStatus);
    }

    private static WorkerRunPersistence CreateService(ApplyFillDbContext dbContext) => new(
        dbContext,
        new SystemClock(),
        new GuidIdentifierGenerator());
}
