using ResumeBuilder.Domain.Common;

namespace ResumeBuilder.Domain.JobApplications;

public enum JobApplicationStatus
{
    Interested,
    Preparing,
    Applied,
    Interviewing,
    Offered,
    Accepted,
    Rejected,
    Withdrawn,
    Archived,
}

public sealed class JobApplication : AggregateRoot
{
    public JobApplication(
        Guid id,
        Guid ownerId,
        string company,
        string jobTitle,
        Uri target,
        JobApplicationStatus status,
        string detailsJson,
        Guid concurrencyToken,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt)
        : base(id, ownerId, concurrencyToken, createdAt, updatedAt)
    {
        Company = company;
        JobTitle = jobTitle;
        Target = target;
        Status = status;
        DetailsJson = detailsJson;
    }

    public string Company { get; private set; }

    public string JobTitle { get; private set; }

    public Uri Target { get; private set; }

    public JobApplicationStatus Status { get; private set; }

    public string DetailsJson { get; private set; }

    public void Update(
        string company,
        string jobTitle,
        Uri target,
        JobApplicationStatus status,
        string detailsJson,
        DateTimeOffset occurredAt)
    {
        Company = company;
        JobTitle = jobTitle;
        Target = target;
        Status = status;
        DetailsJson = detailsJson;
        MarkChanged(occurredAt);
    }
}
