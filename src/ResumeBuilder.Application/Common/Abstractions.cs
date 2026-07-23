namespace ResumeBuilder.Application.Common;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public interface IIdentifierGenerator
{
    Guid NewId();
}

public interface ICurrentInstallation
{
    Guid Id { get; }
}

public interface ISensitiveValueProtector
{
    string Protect(string plaintext);

    string Unprotect(string protectedValue);
}

public interface IArtifactStore
{
    Task<StoredArtifact> PutAsync(
        Guid ownerId,
        Guid artifactId,
        string fileName,
        string mediaType,
        Stream content,
        long maximumBytes,
        CancellationToken cancellationToken);

    Task<Stream?> OpenReadAsync(Guid ownerId, string storageKey, CancellationToken cancellationToken);

    Task DeleteAsync(Guid ownerId, string storageKey, CancellationToken cancellationToken);
}

public sealed record StoredArtifact(string StorageKey, long SizeBytes, string Sha256);

public sealed class ConcurrencyConflictException : Exception
{
    public ConcurrencyConflictException(string aggregateName, Guid id)
        : base($"{aggregateName} '{id}' was changed by another request.")
    {
    }

    public ConcurrencyConflictException(string aggregateName, Guid id, Exception innerException)
        : base($"{aggregateName} '{id}' was changed by another request.", innerException)
    {
    }
}

public sealed class InvalidStateTransitionException : Exception
{
    public InvalidStateTransitionException(string message)
        : base(message)
    {
    }
}
