using System.Globalization;
using System.Text.Json;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;

namespace ResumeBuilder.Application.Profiles;

public sealed record VisibleFormControl(
    string ControlId,
    string Label,
    string Role,
    string? Autocomplete,
    IReadOnlyList<string>? Options);

public sealed record RelevantAnswerQuery(Guid ProfileId, IReadOnlyList<VisibleFormControl> Controls);

public sealed record RelevantAnswerCandidate(
    string ControlId,
    string SourcePath,
    string DisplayName,
    string? Value,
    string? MaskedValue,
    bool IsSensitive,
    bool IsApproved,
    bool RequiresApproval,
    double Confidence);

public interface IRelevantAnswerSource
{
    Task<IReadOnlyList<RelevantAnswerCandidate>> FindCandidatesAsync(
        Guid ownerId,
        RelevantAnswerQuery query,
        CancellationToken cancellationToken);
}

public sealed partial class ProfileRelevantAnswerSource(
    IProfileRepository profiles,
    ISensitiveValueProtector protector) : IRelevantAnswerSource
{
    private const int MaximumControls = 100;
    private const int MaximumCandidatesPerControl = 3;

    public async Task<IReadOnlyList<RelevantAnswerCandidate>> FindCandidatesAsync(
        Guid ownerId,
        RelevantAnswerQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfGreaterThan(query.Controls.Count, MaximumControls);
        var profile = await profiles.FindAsync(ownerId, query.ProfileId, cancellationToken);
        if (profile is null)
        {
            return [];
        }

        var answers = new List<AnswerValue>();
        using (var ordinary = JsonDocument.Parse(profile.ContentJson))
        {
            Flatten(ordinary.RootElement, "profile", false, answers);
        }

        if (profile.ProtectedApplicationData is not null)
        {
            using var sensitive = JsonDocument.Parse(protector.Unprotect(profile.ProtectedApplicationData));
            Flatten(sensitive.RootElement, "applicationData", true, answers);
        }

        var results = new List<RelevantAnswerCandidate>();
        foreach (var control in query.Controls)
        {
            ValidateControl(control);
            var controlTokens = Tokenize($"{control.Label} {control.Role} {control.Autocomplete}");
            var ranked = answers
                .Select(answer => (Answer: answer, Score: Score(control, controlTokens, answer)))
                .Where(item => item.Score >= 0.45)
                .OrderByDescending(item => item.Score)
                .ThenBy(item => item.Answer.Path, StringComparer.Ordinal)
                .Take(MaximumCandidatesPerControl);

            results.AddRange(ranked.Select(item => new RelevantAnswerCandidate(
                control.ControlId,
                item.Answer.Path,
                item.Answer.DisplayName,
                item.Answer.IsSensitive ? null : item.Answer.Value,
                item.Answer.IsSensitive ? Mask(item.Answer.Value) : null,
                item.Answer.IsSensitive,
                IsApproved: false,
                RequiresApproval: item.Answer.IsSensitive,
                item.Score)));
        }

        return results;
    }

    private static void Flatten(JsonElement element, string path, bool isSensitive, List<AnswerValue> output)
    {
        if (output.Count >= 2_000)
        {
            return;
        }

        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    Flatten(property.Value, $"{path}.{property.Name}", isSensitive, output);
                }

                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    Flatten(item, $"{path}[{index++}]", isSensitive, output);
                }

                break;
            case JsonValueKind.String:
                Add(path, element.GetString(), isSensitive, output);
                break;
            case JsonValueKind.Number:
                Add(path, element.GetRawText(), isSensitive, output);
                break;
            case JsonValueKind.True:
                Add(path, "Yes", isSensitive, output);
                break;
            case JsonValueKind.False:
                Add(path, "No", isSensitive, output);
                break;
        }
    }

    private static void Add(string path, string? value, bool isSensitive, List<AnswerValue> output)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 4_000)
        {
            return;
        }

        var leaf = path[(path.LastIndexOf('.') + 1)..].TrimStart('[').TrimEnd(']');
        output.Add(new AnswerValue(path, SplitName(leaf), Normalize(path, value), isSensitive, Tokenize(path)));
    }

    private static double Score(VisibleFormControl control, HashSet<string> controlTokens, AnswerValue answer)
    {
        if (!string.IsNullOrWhiteSpace(control.Autocomplete) &&
            AutocompleteAliases.TryGetValue(control.Autocomplete, out var aliases) &&
            aliases.Any(answer.Tokens.Contains))
        {
            return 0.99;
        }

        var overlap = controlTokens.Intersect(answer.Tokens).Count();
        if (overlap == 0)
        {
            return 0;
        }

        var union = controlTokens.Union(answer.Tokens).Count();
        var score = union == 0 ? 0 : (double)overlap / union;
        if (answer.Tokens.Contains(control.Label.Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant()))
        {
            score += 0.25;
        }

        if (control.Options is { Count: > 0 } && control.Options.Any(option =>
                option.Equals(answer.Value, StringComparison.OrdinalIgnoreCase)))
        {
            score += 0.25;
        }

        return Math.Min(0.98, score + 0.35);
    }

    private static HashSet<string> Tokenize(string value) =>
        SplitCamelCase().Replace(value, "$1 $2")
            .Split(TokenSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.ToLowerInvariant())
            .Where(x => x.Length > 1 && !StopWords.Contains(x))
            .ToHashSet(StringComparer.Ordinal);

    private static string Normalize(string path, string value)
    {
        if (path.Contains("phone", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                return Validation.ProfileValueNormalizer.NormalizeInternationalPhone(value);
            }
            catch (FormatException)
            {
                return value.Trim();
            }
        }

        return value.Trim();
    }

    private static string Mask(string value)
    {
        if (value.Length <= 4)
        {
            return new string('•', value.Length);
        }

        return string.Create(CultureInfo.InvariantCulture, $"••••{value[^4..]}");
    }

    private static string SplitName(string value) => SplitCamelCase().Replace(value, "$1 $2");

    private static void ValidateControl(VisibleFormControl control)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(control.ControlId);
        ArgumentException.ThrowIfNullOrWhiteSpace(control.Label);
        if (control.ControlId.Length > 160 || control.Label.Length > 300 || control.Options?.Count > 200)
        {
            throw new ArgumentException("A visible form control exceeds the accepted bounds.");
        }
    }

    private sealed record AnswerValue(
        string Path,
        string DisplayName,
        string Value,
        bool IsSensitive,
        HashSet<string> Tokens);

    private static readonly char[] TokenSeparators = [' ', '.', '[', ']', '-', '_', '/', ':', '(', ')'];
    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "the", "a", "an", "your", "profile", "applicationdata", "field", "input",
    };
    private static readonly Dictionary<string, string[]> AutocompleteAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"] = ["name", "fullname"],
        ["given-name"] = ["firstname", "givenname"],
        ["family-name"] = ["lastname", "familyname", "surname"],
        ["email"] = ["email", "emailaddress"],
        ["tel"] = ["phone", "telephone", "mobile"],
        ["street-address"] = ["address", "streetaddress"],
        ["address-level2"] = ["city"],
        ["address-level1"] = ["state", "province", "region"],
        ["postal-code"] = ["postalcode", "zipcode", "zip"],
        ["country"] = ["country"],
    };

    [System.Text.RegularExpressions.GeneratedRegex("([a-z0-9])([A-Z])")]
    private static partial System.Text.RegularExpressions.Regex SplitCamelCase();
}
