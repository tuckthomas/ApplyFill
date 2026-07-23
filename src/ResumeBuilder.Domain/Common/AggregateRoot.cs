namespace ResumeBuilder.Domain.Common;

public abstract class AggregateRoot
{
    protected AggregateRoot(Guid id, Guid ownerId, Guid concurrencyToken, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        if (id == Guid.Empty || ownerId == Guid.Empty)
        {
            throw new ArgumentException("Aggregate and owner identifiers are required.");
        }

        Id = id;
        OwnerId = ownerId;
        ConcurrencyToken = concurrencyToken == Guid.Empty ? Guid.NewGuid() : concurrencyToken;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
    }

    public Guid Id { get; }

    public Guid OwnerId { get; }

    public Guid ConcurrencyToken { get; protected set; }

    public DateTimeOffset CreatedAt { get; }

    public DateTimeOffset UpdatedAt { get; protected set; }

    protected void MarkChanged(DateTimeOffset occurredAt)
    {
        UpdatedAt = occurredAt;
        ConcurrencyToken = Guid.NewGuid();
    }
}
