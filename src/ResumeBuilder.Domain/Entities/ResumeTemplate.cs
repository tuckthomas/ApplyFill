namespace ResumeBuilder.Domain.Entities;

public class ResumeTemplate
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string TemplateType { get; set; } = string.Empty;
    public bool SupportsOnePage { get; set; }
    public bool SupportsTwoPage { get; set; }
    public bool SupportsSidebar { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
