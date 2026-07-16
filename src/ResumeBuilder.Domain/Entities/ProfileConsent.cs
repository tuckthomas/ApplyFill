namespace ResumeBuilder.Domain.Entities;

public class ProfileConsent
{
    public Guid Id { get; set; }
    public Guid UserProfileId { get; set; }
    public string ConsentType { get; set; } = string.Empty;
    public string DisclosureVersion { get; set; } = string.Empty;
    public string DisclosureText { get; set; } = string.Empty;
    public string DisclosureSha256 { get; set; } = string.Empty;
    public string CaptureMethod { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime ConsentedAtUtc { get; set; }

    public UserProfile UserProfile { get; set; } = null!;
}
