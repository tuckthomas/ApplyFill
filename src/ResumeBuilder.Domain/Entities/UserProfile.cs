using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class UserProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public Guid? AddressId { get; set; }
    public Address? Address { get; set; }
    public ICollection<WebLink> WebLinks { get; set; } = new List<WebLink>();
    public ICollection<ProfileConsent> Consents { get; set; } = new List<ProfileConsent>();
    public WorkAuthorization? WorkAuthorizationStatus { get; set; }
    public bool? RequiresSponsorship { get; set; }
    public string? DesiredCompensation { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
