namespace ResumeBuilder.Domain.Entities;

public class Resume
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? TargetRole { get; set; }
    public string? TargetIndustry { get; set; }
    public string? SelectedTemplateId { get; set; }
    public string? SelectedLayoutPreset { get; set; }
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<ResumeExperience> Experiences { get; set; } = new List<ResumeExperience>();
    public ICollection<ResumeEducation> Educations { get; set; } = new List<ResumeEducation>();
    public ICollection<ResumeSkill> Skills { get; set; } = new List<ResumeSkill>();
    public ICollection<ResumeLayoutAnalysis> LayoutAnalyses { get; set; } = new List<ResumeLayoutAnalysis>();
    public ICollection<ResumeDocument> Documents { get; set; } = new List<ResumeDocument>();
}
