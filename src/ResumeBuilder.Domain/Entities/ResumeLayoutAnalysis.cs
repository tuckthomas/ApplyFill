using System.Text.Json;

namespace ResumeBuilder.Domain.Entities;

public class ResumeLayoutAnalysis
{
    public Guid Id { get; set; }
    public Guid ResumeId { get; set; }
    public string TemplateId { get; set; } = string.Empty;
    public string LayoutPreset { get; set; } = string.Empty;
    public int EstimatedPages { get; set; }
    public bool FitsOnePage { get; set; }
    public int Score { get; set; }
    public JsonDocument? WarningsJson { get; set; }
    public JsonDocument? RecommendedAdjustmentsJson { get; set; }
    public DateTime CreatedAt { get; set; }

    public Resume Resume { get; set; } = null!;
}
