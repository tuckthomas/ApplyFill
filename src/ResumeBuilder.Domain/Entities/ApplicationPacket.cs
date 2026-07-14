using System.Text.Json;
using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class ApplicationPacket
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ResumeId { get; set; }
    public Guid JobTargetId { get; set; }
    public JsonDocument? PacketJson { get; set; }
    public ApplicationStatus Status { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public Resume Resume { get; set; } = null!;
    public JobTarget JobTarget { get; set; } = null!;
    public ICollection<ApplicationLog> Logs { get; set; } = new List<ApplicationLog>();
    public ICollection<ResumeDocument> Documents { get; set; } = new List<ResumeDocument>();
}
