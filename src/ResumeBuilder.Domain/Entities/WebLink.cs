namespace ResumeBuilder.Domain.Entities;

public class WebLink
{
    public Guid Id { get; set; }
    public Guid UserProfileId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    
    public UserProfile UserProfile { get; set; } = null!;
}
