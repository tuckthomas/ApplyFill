namespace ResumeBuilder.Domain.Entities;

public class ResumeBullet
{
    public Guid Id { get; set; }
    public Guid ExperienceId { get; set; }
    public string RawText { get; set; } = string.Empty;
    public string? EnhancedText { get; set; }
    public string? SelectedText { get; set; }
    public int SortOrder { get; set; }
    public string? AiProvider { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ResumeExperience Experience { get; set; } = null!;
}
