namespace ResumeBuilder.Domain.Entities;

public class JobTarget
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string TargetJobUrl { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? BaseSalary { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<ApplicationPacket> ApplicationPackets { get; set; } = new List<ApplicationPacket>();
    public ICollection<ApplicationLog> ApplicationLogs { get; set; } = new List<ApplicationLog>();
}
