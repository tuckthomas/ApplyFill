using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class ResumeDocument
{
    public Guid Id { get; set; }
    public Guid ResumeId { get; set; }
    public string? Provider { get; set; }
    public string? ProviderFileId { get; set; }
    public string? ProviderFolderId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Version { get; set; }
    public DocumentStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Resume Resume { get; set; } = null!;
    public ICollection<ApplicationPacket> ApplicationPackets { get; set; } = new List<ApplicationPacket>();
}
