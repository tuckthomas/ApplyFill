namespace ResumeBuilder.Application.Services;

public interface IAiService
{
    Task<string> EnhanceBulletPointAsync(string bulletPoint, CancellationToken cancellationToken = default);
    Task<string> SuggestSummaryAsync(string currentSummary, string profileData, CancellationToken cancellationToken = default);
    Task<string> EnhanceExperienceDescriptionAsync(string description, CancellationToken cancellationToken = default);
    Task<string> EnhanceProjectDescriptionAsync(string description, CancellationToken cancellationToken = default);
}
