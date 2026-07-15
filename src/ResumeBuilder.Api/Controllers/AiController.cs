using Microsoft.AspNetCore.Mvc;
using ResumeBuilder.Application.Services;

namespace ResumeBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly IAiService _aiService;

    public AiController(IAiService aiService)
    {
        _aiService = aiService;
    }

    [HttpPost("enhance-bullet")]
    public async Task<IActionResult> EnhanceBullet([FromBody] EnhanceBulletRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.BulletPoint))
        {
            return BadRequest("Bullet point is required.");
        }

        try
        {
            var enhancedBullet = await _aiService.EnhanceBulletPointAsync(request.BulletPoint, cancellationToken);
            return Ok(new { EnhancedBullet = enhancedBullet });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ex.Message);
        }
        catch (Exception ex)
        {
            // Log exception here
            return StatusCode(500, $"An error occurred while enhancing the bullet point: {ex.Message}");
        }
    }

    [HttpPost("suggest-summary")]
    public async Task<IActionResult> SuggestSummary([FromBody] SuggestSummaryRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentSummary))
        {
            return BadRequest("Current summary is required.");
        }

        try
        {
            var suggestedSummary = await _aiService.SuggestSummaryAsync(request.CurrentSummary, request.ProfileData ?? "", cancellationToken);
            return Ok(new { SuggestedSummary = suggestedSummary });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ex.Message);
        }
        catch (Exception ex)
        {
            // Log exception here
            return StatusCode(500, $"An error occurred while suggesting a summary: {ex.Message}");
        }
    }

    [HttpPost("enhance-experience")]
    public async Task<IActionResult> EnhanceExperience([FromBody] EnhanceExperienceRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest("Description is required.");
        }

        try
        {
            var enhancedDescription = await _aiService.EnhanceExperienceDescriptionAsync(request.Description, cancellationToken);
            return Ok(new { EnhancedDescription = enhancedDescription });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ex.Message);
        }
        catch (Exception ex)
        {
            // Log exception here
            return StatusCode(500, $"An error occurred while enhancing the experience description: {ex.Message}");
        }
    }

    [HttpPost("enhance-project")]
    public async Task<IActionResult> EnhanceProject([FromBody] EnhanceProjectRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest("Description is required.");
        }

        try
        {
            var enhancedDescription = await _aiService.EnhanceProjectDescriptionAsync(request.Description, cancellationToken);
            return Ok(new { EnhancedDescription = enhancedDescription });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ex.Message);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"An error occurred while enhancing the project description: {ex.Message}");
        }
    }
}

public class EnhanceBulletRequest
{
    public string BulletPoint { get; set; } = string.Empty;
}

public class SuggestSummaryRequest
{
    public string CurrentSummary { get; set; } = string.Empty;
    public string? ProfileData { get; set; }
}

public class EnhanceExperienceRequest
{
    public string Description { get; set; } = string.Empty;
}

public class EnhanceProjectRequest
{
    public string Description { get; set; } = string.Empty;
}
