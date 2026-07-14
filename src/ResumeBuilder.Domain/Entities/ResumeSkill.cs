namespace ResumeBuilder.Domain.Entities;

public class ResumeSkill
{
    public Guid Id { get; set; }
    public Guid ResumeId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public Resume Resume { get; set; } = null!;
}
