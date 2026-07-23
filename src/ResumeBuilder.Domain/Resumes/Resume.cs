#pragma warning disable CA1716 // Resume is the established product-domain term, despite being a Visual Basic keyword.
using ResumeBuilder.Domain.Common;

namespace ResumeBuilder.Domain.Resumes;

public sealed class Resume : AggregateRoot
{
    public Resume(
        Guid id,
        Guid ownerId,
        string name,
        int schemaVersion,
        string contentJson,
        Guid concurrencyToken,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt)
        : base(id, ownerId, concurrencyToken, createdAt, updatedAt)
    {
        Name = name;
        SchemaVersion = schemaVersion;
        ContentJson = contentJson;
    }

    public string Name { get; private set; }

    public int SchemaVersion { get; private set; }

    public string ContentJson { get; private set; }

    public void Update(string name, int schemaVersion, string contentJson, DateTimeOffset occurredAt)
    {
        Name = name;
        SchemaVersion = schemaVersion;
        ContentJson = contentJson;
        MarkChanged(occurredAt);
    }
}

public sealed record ResumeArtifact(
    Guid Id,
    Guid OwnerId,
    Guid ResumeId,
    string FileName,
    string MediaType,
    long SizeBytes,
    string Sha256,
    string StorageKey,
    DateTimeOffset CreatedAt);
#pragma warning restore CA1716
