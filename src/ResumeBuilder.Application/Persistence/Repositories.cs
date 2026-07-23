using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Domain.JobApplications;
using ResumeBuilder.Domain.Profiles;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Application.Persistence;

public interface IProfileRepository
{
    Task<Profile?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken);

    Task<Profile?> FindCurrentAsync(Guid ownerId, CancellationToken cancellationToken);

    Task SaveAsync(Profile profile, Guid? expectedToken, CancellationToken cancellationToken);

    Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken);
}

public interface IResumeRepository
{
    Task<Resume?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Resume>> ListAsync(Guid ownerId, int skip, int take, CancellationToken cancellationToken);

    Task SaveAsync(Resume document, Guid? expectedToken, CancellationToken cancellationToken);

    Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken);
}

public interface IResumeArtifactRepository
{
    Task<ResumeArtifact?> FindAsync(Guid ownerId, Guid resumeId, Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<ResumeArtifact>> ListAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken);

    Task AddAsync(ResumeArtifact artifact, CancellationToken cancellationToken);

    Task<ResumeArtifact?> DeleteAsync(Guid ownerId, Guid resumeId, Guid id, CancellationToken cancellationToken);
}

public interface IJobApplicationRepository
{
    Task<JobApplication?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<JobApplication>> ListAsync(
        Guid ownerId,
        JobApplicationStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task SaveAsync(JobApplication application, Guid? expectedToken, CancellationToken cancellationToken);

    Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken);
}

public interface IApplicationRunRepository
{
    Task<ApplicationRun?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<ApplicationRun>> ListAsync(
        Guid ownerId,
        ApplicationRunStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task SaveAsync(ApplicationRun run, Guid? expectedToken, CancellationToken cancellationToken);

    Task AppendCheckpointAsync(RunCheckpoint checkpoint, CancellationToken cancellationToken);

    Task<IReadOnlyList<RunCheckpoint>> ListCheckpointsAsync(
        Guid ownerId,
        Guid runId,
        long afterSequence,
        int take,
        CancellationToken cancellationToken);
}

public sealed record UserSettingResource(
    Guid Id,
    Guid OwnerId,
    string Key,
    int SchemaVersion,
    string ContentJson,
    Guid ConcurrencyToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public interface IUserSettingRepository
{
    Task<UserSettingResource?> FindAsync(
        Guid ownerId,
        string key,
        CancellationToken cancellationToken);

    Task SaveAsync(
        UserSettingResource resource,
        Guid? expectedToken,
        CancellationToken cancellationToken);
}
