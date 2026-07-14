using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class ApplicationLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? ApplicationPacketId { get; set; }
    public Guid JobTargetId { get; set; }
    public ApplicationStatus Status { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public JobTarget JobTarget { get; set; } = null!;
    public ApplicationPacket? ApplicationPacket { get; set; }
}
