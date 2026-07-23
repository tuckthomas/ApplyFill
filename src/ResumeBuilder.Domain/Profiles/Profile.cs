using ResumeBuilder.Domain.Common;

namespace ResumeBuilder.Domain.Profiles;

public sealed class Profile : AggregateRoot
{
    public Profile(
        Guid id,
        Guid ownerId,
        int schemaVersion,
        string contentJson,
        string? protectedApplicationData,
        Guid concurrencyToken,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt)
        : base(id, ownerId, concurrencyToken, createdAt, updatedAt)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(schemaVersion, 1);

        SchemaVersion = schemaVersion;
        ContentJson = contentJson ?? throw new ArgumentNullException(nameof(contentJson));
        ProtectedApplicationData = protectedApplicationData;
    }

    public int SchemaVersion { get; private set; }

    public string ContentJson { get; private set; }

    public string? ProtectedApplicationData { get; private set; }

    public void Update(int schemaVersion, string contentJson, string? protectedApplicationData, DateTimeOffset occurredAt)
    {
        SchemaVersion = schemaVersion;
        ContentJson = contentJson;
        ProtectedApplicationData = protectedApplicationData;
        MarkChanged(occurredAt);
    }
}
