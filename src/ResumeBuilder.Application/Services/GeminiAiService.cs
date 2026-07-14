using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;

namespace ResumeBuilder.Application.Services;

public class GeminiAiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private const string GeminiApiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    public GeminiAiService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<string> EnhanceBulletPointAsync(string bulletPoint, CancellationToken cancellationToken = default)
    {
        var prompt = $"Enhance the following resume bullet point to make it more professional, impactful, and action-oriented. Return ONLY the enhanced bullet point without quotes or extra conversational text.\n\nOriginal: {bulletPoint}";
        
        return await CallGeminiAsync(prompt, cancellationToken);
    }

    public async Task<string> SuggestSummaryAsync(string currentSummary, string profileData, CancellationToken cancellationToken = default)
    {
        var prompt = $"Rewrite the following professional summary to be more compelling and concise, using the provided profile context. Return ONLY the rewritten summary.\n\nCurrent Summary: {currentSummary}\n\nProfile Context: {profileData}";
        
        return await CallGeminiAsync(prompt, cancellationToken);
    }

    public async Task<string> EnhanceExperienceDescriptionAsync(string description, CancellationToken cancellationToken = default)
    {
        var prompt = $"Take the following work experience description (which may be paragraph or bullet format) and rewrite it into highly professional, action-oriented bullet points. Return ONLY the HTML string using <ul> and <li> tags with NO markdown formatting, NO extra conversational text, and NO backticks. Make it sound extremely impressive.\n\nDescription: {description}";
        
        return await CallGeminiAsync(prompt, cancellationToken);
    }

    private async Task<string> CallGeminiAsync(string prompt, CancellationToken cancellationToken)
    {
        var apiKey = _configuration["Gemini:ApiKey"] ?? _configuration["GEMINI_API_KEY"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("AI provider is not configured on the backend.");
        }

        var requestUrl = $"{GeminiApiBaseUrl}?key={apiKey}";
        
        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            },
            generationConfig = new
            {
                temperature = 0.7,
                topK = 40,
                topP = 0.95,
                maxOutputTokens = 1024,
            }
        };

        var response = await _httpClient.PostAsJsonAsync(requestUrl, requestBody, cancellationToken);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new Exception($"Gemini API request failed with status code {response.StatusCode}: {errorContent}");
        }

        var responseBody = await response.Content.ReadFromJsonAsync<GeminiResponse>(cancellationToken: cancellationToken);
        
        var generatedText = responseBody?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;
        
        if (string.IsNullOrWhiteSpace(generatedText))
        {
            throw new Exception("Gemini API returned an empty response.");
        }

        return generatedText.Trim();
    }

    // Basic classes for deserialization
    private class GeminiResponse
    {
        [JsonPropertyName("candidates")]
        public List<Candidate>? Candidates { get; set; }
    }

    private class Candidate
    {
        [JsonPropertyName("content")]
        public Content? Content { get; set; }
    }

    private class Content
    {
        [JsonPropertyName("parts")]
        public List<Part>? Parts { get; set; }
    }

    private class Part
    {
        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }
}
