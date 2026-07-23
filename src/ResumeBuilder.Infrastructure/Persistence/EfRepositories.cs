using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Domain.ApplicationRuns;
using ResumeBuilder.Domain.JobApplications;
using ResumeBuilder.Domain.Profiles;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class EfProfileRepository(ApplyFillDbContext dbContext) : IProfileRepository
{
    public async Task<Profile?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken)
    {
        var row = await dbContext.Profiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Id == id, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<Profile?> FindCurrentAsync(Guid ownerId, CancellationToken cancellationToken)
    {
        var row = await dbContext.Profiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == ownerId, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task SaveAsync(Profile profile, Guid? expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.Profiles
            .SingleOrDefaultAsync(x => x.OwnerId == profile.OwnerId && x.Id == profile.Id, cancellationToken);

        if (row is null)
        {
            if (expectedToken is not null)
            {
                throw new ConcurrencyConflictException(nameof(Profile), profile.Id);
            }

            dbContext.Profiles.Add(ToRecord(profile));
        }
        else
        {
            EnsureToken(expectedToken, row.ConcurrencyToken, nameof(Profile), profile.Id);
            row.SchemaVersion = profile.SchemaVersion;
            row.ContentJson = profile.ContentJson;
            row.ProtectedApplicationData = profile.ProtectedApplicationData;
            row.ConcurrencyToken = profile.ConcurrencyToken;
            row.UpdatedAt = profile.UpdatedAt;
        }

        await SaveChangesAsync(dbContext, nameof(Profile), profile.Id, cancellationToken);
    }

    public async Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.Profiles.SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Id == id, cancellationToken);
        if (row is null)
        {
            return;
        }

        EnsureToken(expectedToken, row.ConcurrencyToken, nameof(Profile), id);
        dbContext.Profiles.Remove(row);
        await SaveChangesAsync(dbContext, nameof(Profile), id, cancellationToken);
    }

    private static Profile Map(ProfileRecord row) => new(
        row.Id,
        row.OwnerId,
        row.SchemaVersion,
        row.ContentJson,
        row.ProtectedApplicationData,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.UpdatedAt);

    private static ProfileRecord ToRecord(Profile profile) => new()
    {
        Id = profile.Id,
        OwnerId = profile.OwnerId,
        SchemaVersion = profile.SchemaVersion,
        ContentJson = profile.ContentJson,
        ProtectedApplicationData = profile.ProtectedApplicationData,
        ConcurrencyToken = profile.ConcurrencyToken,
        CreatedAt = profile.CreatedAt,
        UpdatedAt = profile.UpdatedAt,
    };

    internal static void EnsureToken(Guid? expected, Guid current, string aggregate, Guid id)
    {
        if (expected is null || expected.Value != current)
        {
            throw new ConcurrencyConflictException(aggregate, id);
        }
    }

    internal static async Task SaveChangesAsync(
        ApplyFillDbContext dbContext,
        string aggregate,
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            throw new ConcurrencyConflictException(aggregate, id, exception);
        }
    }
}

public sealed class EfResumeRepository(ApplyFillDbContext dbContext) : IResumeRepository
{
    public async Task<Resume?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken)
    {
        var row = await dbContext.Resumes.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Id == id, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<Resume>> ListAsync(Guid ownerId, int skip, int take, CancellationToken cancellationToken) =>
        await dbContext.Resumes.AsNoTracking()
            .Where(x => x.OwnerId == ownerId)
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(skip)
            .Take(take)
            .Select(x => new Resume(x.Id, x.OwnerId, x.Name, x.SchemaVersion, x.ContentJson, x.ConcurrencyToken, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

    public async Task SaveAsync(Resume document, Guid? expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.Resumes.SingleOrDefaultAsync(
            x => x.OwnerId == document.OwnerId && x.Id == document.Id,
            cancellationToken);
        if (row is null)
        {
            if (expectedToken is not null)
            {
                throw new ConcurrencyConflictException(nameof(Resume), document.Id);
            }

            dbContext.Resumes.Add(ToRecord(document));
        }
        else
        {
            EfProfileRepository.EnsureToken(expectedToken, row.ConcurrencyToken, nameof(Resume), document.Id);
            row.Name = document.Name;
            row.SchemaVersion = document.SchemaVersion;
            row.ContentJson = document.ContentJson;
            row.ConcurrencyToken = document.ConcurrencyToken;
            row.UpdatedAt = document.UpdatedAt;
        }

        await EfProfileRepository.SaveChangesAsync(dbContext, nameof(Resume), document.Id, cancellationToken);
    }

    public async Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.Resumes.SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Id == id, cancellationToken);
        if (row is null)
        {
            return;
        }

        EfProfileRepository.EnsureToken(expectedToken, row.ConcurrencyToken, nameof(Resume), id);
        dbContext.Resumes.Remove(row);
        await EfProfileRepository.SaveChangesAsync(dbContext, nameof(Resume), id, cancellationToken);
    }

    private static Resume Map(ResumeRecord row) => new(
        row.Id,
        row.OwnerId,
        row.Name,
        row.SchemaVersion,
        row.ContentJson,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.UpdatedAt);

    private static ResumeRecord ToRecord(Resume document) => new()
    {
        Id = document.Id,
        OwnerId = document.OwnerId,
        Name = document.Name,
        SchemaVersion = document.SchemaVersion,
        ContentJson = document.ContentJson,
        ConcurrencyToken = document.ConcurrencyToken,
        CreatedAt = document.CreatedAt,
        UpdatedAt = document.UpdatedAt,
    };
}

public sealed class EfResumeArtifactRepository(ApplyFillDbContext dbContext) : IResumeArtifactRepository
{
    public async Task<ResumeArtifact?> FindAsync(
        Guid ownerId,
        Guid resumeId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.ResumeArtifacts.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OwnerId == ownerId && x.ResumeId == resumeId && x.Id == id,
                cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<ResumeArtifact>> ListAsync(
        Guid ownerId,
        Guid resumeId,
        CancellationToken cancellationToken) =>
        await dbContext.ResumeArtifacts.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && x.ResumeId == resumeId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResumeArtifact(
                x.Id,
                x.OwnerId,
                x.ResumeId,
                x.FileName,
                x.MediaType,
                x.SizeBytes,
                x.Sha256,
                x.StorageKey,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task AddAsync(ResumeArtifact artifact, CancellationToken cancellationToken)
    {
        var ownsResume = await dbContext.Resumes.AsNoTracking()
            .AnyAsync(x => x.OwnerId == artifact.OwnerId && x.Id == artifact.ResumeId, cancellationToken);
        if (!ownsResume)
        {
            throw new InvalidOperationException("The resume does not belong to the current installation.");
        }

        dbContext.ResumeArtifacts.Add(new ResumeArtifactRecord
        {
            Id = artifact.Id,
            OwnerId = artifact.OwnerId,
            ResumeId = artifact.ResumeId,
            FileName = artifact.FileName,
            MediaType = artifact.MediaType,
            SizeBytes = artifact.SizeBytes,
            Sha256 = artifact.Sha256,
            StorageKey = artifact.StorageKey,
            CreatedAt = artifact.CreatedAt,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<ResumeArtifact?> DeleteAsync(
        Guid ownerId,
        Guid resumeId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.ResumeArtifacts.SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.ResumeId == resumeId && x.Id == id,
            cancellationToken);
        if (row is null)
        {
            return null;
        }

        dbContext.ResumeArtifacts.Remove(row);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(row);
    }

    private static ResumeArtifact Map(ResumeArtifactRecord row) => new(
        row.Id,
        row.OwnerId,
        row.ResumeId,
        row.FileName,
        row.MediaType,
        row.SizeBytes,
        row.Sha256,
        row.StorageKey,
        row.CreatedAt);
}

public sealed class EfJobApplicationRepository(ApplyFillDbContext dbContext) : IJobApplicationRepository
{
    public async Task<JobApplication?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken)
    {
        var row = await dbContext.JobApplications.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Id == id, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<JobApplication>> ListAsync(
        Guid ownerId,
        JobApplicationStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken) =>
        await dbContext.JobApplications.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && (status == null || x.Status == status))
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(skip)
            .Take(take)
            .Select(x => new JobApplication(
                x.Id,
                x.OwnerId,
                x.Company,
                x.JobTitle,
                new Uri(x.TargetUrl),
                x.Status,
                x.DetailsJson,
                x.ConcurrencyToken,
                x.CreatedAt,
                x.UpdatedAt))
            .ToListAsync(cancellationToken);

    public async Task SaveAsync(JobApplication application, Guid? expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.JobApplications.SingleOrDefaultAsync(
            x => x.OwnerId == application.OwnerId && x.Id == application.Id,
            cancellationToken);
        if (row is null)
        {
            if (expectedToken is not null)
            {
                throw new ConcurrencyConflictException(nameof(JobApplication), application.Id);
            }

            dbContext.JobApplications.Add(ToRecord(application));
        }
        else
        {
            EfProfileRepository.EnsureToken(expectedToken, row.ConcurrencyToken, nameof(JobApplication), application.Id);
            row.Company = application.Company;
            row.JobTitle = application.JobTitle;
            row.TargetUrl = application.Target.AbsoluteUri;
            row.Status = application.Status;
            row.DetailsJson = application.DetailsJson;
            row.ConcurrencyToken = application.ConcurrencyToken;
            row.UpdatedAt = application.UpdatedAt;
        }

        await EfProfileRepository.SaveChangesAsync(dbContext, nameof(JobApplication), application.Id, cancellationToken);
    }

    public async Task DeleteAsync(Guid ownerId, Guid id, Guid expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.JobApplications.SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Id == id,
            cancellationToken);
        if (row is null)
        {
            return;
        }

        EfProfileRepository.EnsureToken(expectedToken, row.ConcurrencyToken, nameof(JobApplication), id);
        dbContext.JobApplications.Remove(row);
        await EfProfileRepository.SaveChangesAsync(dbContext, nameof(JobApplication), id, cancellationToken);
    }

    private static JobApplication Map(JobApplicationRecord row) => new(
        row.Id,
        row.OwnerId,
        row.Company,
        row.JobTitle,
        new Uri(row.TargetUrl),
        row.Status,
        row.DetailsJson,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.UpdatedAt);

    private static JobApplicationRecord ToRecord(JobApplication application) => new()
    {
        Id = application.Id,
        OwnerId = application.OwnerId,
        Company = application.Company,
        JobTitle = application.JobTitle,
        TargetUrl = application.Target.AbsoluteUri,
        Status = application.Status,
        DetailsJson = application.DetailsJson,
        ConcurrencyToken = application.ConcurrencyToken,
        CreatedAt = application.CreatedAt,
        UpdatedAt = application.UpdatedAt,
    };
}

public sealed class EfApplicationRunRepository(ApplyFillDbContext dbContext) : IApplicationRunRepository
{
    public async Task<ApplicationRun?> FindAsync(Guid ownerId, Guid id, CancellationToken cancellationToken)
    {
        var row = await dbContext.ApplicationRuns.AsNoTracking()
            .SingleOrDefaultAsync(x => x.OwnerId == ownerId && x.Id == id, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<ApplicationRun>> ListAsync(
        Guid ownerId,
        ApplicationRunStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.ApplicationRuns.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && (status == null || x.Status == status))
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);
        return rows.Select(Map).ToArray();
    }

    public async Task SaveAsync(ApplicationRun run, Guid? expectedToken, CancellationToken cancellationToken)
    {
        var row = await dbContext.ApplicationRuns.SingleOrDefaultAsync(
            x => x.OwnerId == run.OwnerId && x.Id == run.Id,
            cancellationToken);
        if (row is null)
        {
            if (expectedToken is not null)
            {
                throw new ConcurrencyConflictException(nameof(ApplicationRun), run.Id);
            }

            dbContext.ApplicationRuns.Add(ToRecord(run));
        }
        else
        {
            EfProfileRepository.EnsureToken(expectedToken, row.ConcurrencyToken, nameof(ApplicationRun), run.Id);
            row.Status = run.Status;
            row.Stage = run.Stage;
            row.ControlOwner = run.ControlOwner;
            row.RetryCount = run.RetryCount;
            row.BrowserSessionReference = run.BrowserSessionReference;
            row.ConcurrencyToken = run.ConcurrencyToken;
            row.UpdatedAt = run.UpdatedAt;
        }

        await EfProfileRepository.SaveChangesAsync(dbContext, nameof(ApplicationRun), run.Id, cancellationToken);
    }

    public async Task AppendCheckpointAsync(RunCheckpoint checkpoint, CancellationToken cancellationToken)
    {
        var run = await dbContext.ApplicationRuns
            .SingleOrDefaultAsync(x => x.Id == checkpoint.RunId && x.OwnerId == checkpoint.OwnerId, cancellationToken);
        if (run is null)
        {
            throw new InvalidOperationException("The run does not belong to the current installation.");
        }

        if (checkpoint.Sequence <= run.LastCheckpointSequence)
        {
            throw new ConcurrencyConflictException(nameof(RunCheckpoint), checkpoint.RunId);
        }

        run.LastCheckpointSequence = checkpoint.Sequence;

        dbContext.RunCheckpoints.Add(new RunCheckpointRecord
        {
            Id = checkpoint.Id,
            OwnerId = checkpoint.OwnerId,
            RunId = checkpoint.RunId,
            Sequence = checkpoint.Sequence,
            Status = checkpoint.Status,
            Stage = checkpoint.Stage,
            CurrentUrl = checkpoint.CurrentUrl,
            CurrentDomain = checkpoint.CurrentDomain,
            SummaryJson = checkpoint.SummaryJson,
            CreatedAt = checkpoint.CreatedAt,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RunCheckpoint>> ListCheckpointsAsync(
        Guid ownerId,
        Guid runId,
        long afterSequence,
        int take,
        CancellationToken cancellationToken) =>
        await dbContext.RunCheckpoints.AsNoTracking()
            .Where(x => x.OwnerId == ownerId && x.RunId == runId && x.Sequence > afterSequence)
            .OrderBy(x => x.Sequence)
            .Take(take)
            .Select(x => new RunCheckpoint(
                x.Id,
                x.OwnerId,
                x.RunId,
                x.Sequence,
                x.Status,
                x.Stage,
                x.CurrentUrl,
                x.CurrentDomain,
                x.SummaryJson,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

    private static ApplicationRun Map(ApplicationRunRecord row) => new(
        row.Id,
        row.OwnerId,
        row.JobApplicationId,
        row.ProfileId,
        row.ResumeId,
        new Uri(row.TargetUrl),
        row.Status,
        row.Stage,
        row.ControlOwner,
        row.RetryCount,
        row.BrowserSessionReference,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.UpdatedAt);

    private static ApplicationRunRecord ToRecord(ApplicationRun run) => new()
    {
        Id = run.Id,
        OwnerId = run.OwnerId,
        JobApplicationId = run.JobApplicationId,
        ProfileId = run.ProfileId,
        ResumeId = run.ResumeId,
        TargetUrl = run.Target.AbsoluteUri,
        Status = run.Status,
        Stage = run.Stage,
        ControlOwner = run.ControlOwner,
        RetryCount = run.RetryCount,
        LastCheckpointSequence = -1,
        BrowserSessionReference = run.BrowserSessionReference,
        ConcurrencyToken = run.ConcurrencyToken,
        CreatedAt = run.CreatedAt,
        UpdatedAt = run.UpdatedAt,
    };
}

public sealed class EfUserSettingRepository(ApplyFillDbContext dbContext) : IUserSettingRepository
{
    public async Task<UserSettingResource?> FindAsync(
        Guid ownerId,
        string key,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.UserSettings.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerId == ownerId && x.Key == key,
            cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task SaveAsync(
        UserSettingResource resource,
        Guid? expectedToken,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.UserSettings.SingleOrDefaultAsync(
            x => x.OwnerId == resource.OwnerId && x.Key == resource.Key,
            cancellationToken);
        if (row is null)
        {
            if (expectedToken is not null)
            {
                throw new ConcurrencyConflictException(nameof(UserSettingResource), resource.Id);
            }

            dbContext.UserSettings.Add(ToRecord(resource));
        }
        else
        {
            EfProfileRepository.EnsureToken(
                expectedToken,
                row.ConcurrencyToken,
                nameof(UserSettingResource),
                resource.Id);
            row.SchemaVersion = resource.SchemaVersion;
            row.ContentJson = resource.ContentJson;
            row.ConcurrencyToken = resource.ConcurrencyToken;
            row.UpdatedAt = resource.UpdatedAt;
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            throw new ConcurrencyConflictException(nameof(UserSettingResource), resource.Id, exception);
        }
        catch (DbUpdateException exception)
        {
            throw new ConcurrencyConflictException(nameof(UserSettingResource), resource.Id, exception);
        }
    }

    private static UserSettingResource Map(UserSettingRecord row) => new(
        row.Id,
        row.OwnerId,
        row.Key,
        row.SchemaVersion,
        row.ContentJson,
        row.ConcurrencyToken,
        row.CreatedAt,
        row.UpdatedAt);

    private static UserSettingRecord ToRecord(UserSettingResource resource) => new()
    {
        Id = resource.Id,
        OwnerId = resource.OwnerId,
        Key = resource.Key,
        SchemaVersion = resource.SchemaVersion,
        ContentJson = resource.ContentJson,
        ConcurrencyToken = resource.ConcurrencyToken,
        CreatedAt = resource.CreatedAt,
        UpdatedAt = resource.UpdatedAt,
    };
}
