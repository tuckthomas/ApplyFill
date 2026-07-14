namespace ResumeBuilder.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? GoogleAccountId { get; set; }
    public string? MicrosoftAccountId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public UserProfile? Profile { get; set; }
    public ICollection<Resume> Resumes { get; set; } = new List<Resume>();
    public ICollection<JobTarget> JobTargets { get; set; } = new List<JobTarget>();
    public ICollection<ApplicationPacket> ApplicationPackets { get; set; } = new List<ApplicationPacket>();
    public ICollection<ApplicationLog> ApplicationLogs { get; set; } = new List<ApplicationLog>();
}
