namespace ResumeBuilder.Application.Persistence;

public sealed record ProfileSourceResume(
    Guid Id,
    Guid OwnerId,
    string FileName,
    string MediaType,
    long SizeBytes,
    string Sha256,
    string StorageKey,
    DateTimeOffset CreatedAt);

public interface IProfileSourceResumeRepository
{
    Task<ProfileSourceResume?> FindCurrentAsync(Guid ownerId, CancellationToken cancellationToken);

    Task<ProfileSourceResume?> ReplaceAsync(
        ProfileSourceResume sourceResume,
        CancellationToken cancellationToken);

    Task<ProfileSourceResume?> DeleteAsync(Guid ownerId, CancellationToken cancellationToken);
}
