using System.Text.Json;
using System.Text.RegularExpressions;

namespace ResumeBuilder.Application.Validation;

public static partial class StructuredJsonValidator
{
    public const int DefaultMaximumBytes = 512 * 1024;
    private const int MaximumDepth = 32;
    private const int MaximumNodes = 10_000;
    private const int MaximumArrayItems = 500;
    private const int MaximumStringLength = 32_768;

    public static string ValidateAndNormalize(JsonElement value, int maximumBytes = DefaultMaximumBytes)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            throw new StructuredDocumentException("The document must be a JSON object.");
        }

        var nodeCount = 0;
        ValidateNode(value, 0, ref nodeCount);
        var json = JsonSerializer.Serialize(value, SerializerOptions);
        if (System.Text.Encoding.UTF8.GetByteCount(json) > maximumBytes)
        {
            throw new StructuredDocumentException($"The document exceeds the {maximumBytes}-byte limit.");
        }

        return json;
    }

    public static void RejectSensitiveProfileFields(JsonElement value)
    {
        var path = FindSensitiveProperty(value);
        if (path is not null)
        {
            throw new StructuredDocumentException(
                $"'{path}' must be sent in the separately protected application-data section.");
        }
    }

    private static string? FindSensitiveProperty(JsonElement element, string path = "profile")
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                var childPath = $"{path}.{property.Name}";
                if (SensitivePropertyNames.Contains(property.Name))
                {
                    return childPath;
                }

                var result = FindSensitiveProperty(property.Value, childPath);
                if (result is not null)
                {
                    return result;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var child in element.EnumerateArray())
            {
                var result = FindSensitiveProperty(child, $"{path}[{index++}]");
                if (result is not null)
                {
                    return result;
                }
            }
        }

        return null;
    }

    private static void ValidateNode(JsonElement element, int depth, ref int nodeCount)
    {
        if (depth > MaximumDepth || ++nodeCount > MaximumNodes)
        {
            throw new StructuredDocumentException("The document is too deeply nested or complex.");
        }

        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    if (property.Name.Equals("html", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new StructuredDocumentException("Raw HTML is not accepted. Use restricted rich-text JSON.");
                    }

                    ValidateNode(property.Value, depth + 1, ref nodeCount);
                }

                break;
            case JsonValueKind.Array:
                if (element.GetArrayLength() > MaximumArrayItems)
                {
                    throw new StructuredDocumentException($"Arrays may contain at most {MaximumArrayItems} items.");
                }

                foreach (var child in element.EnumerateArray())
                {
                    ValidateNode(child, depth + 1, ref nodeCount);
                }

                break;
            case JsonValueKind.String:
                var text = element.GetString() ?? string.Empty;
                if (text.Length > MaximumStringLength)
                {
                    throw new StructuredDocumentException($"Text values may contain at most {MaximumStringLength} characters.");
                }

                if (HtmlTagPattern().IsMatch(text))
                {
                    throw new StructuredDocumentException("Raw HTML is not accepted. Use restricted rich-text JSON.");
                }

                break;
        }
    }

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        MaxDepth = MaximumDepth,
        WriteIndented = false,
    };

    private static readonly HashSet<string> SensitivePropertyNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "socialSecurityNumber",
        "ssn",
        "nationalIdentifier",
        "nationalId",
        "taxIdentifier",
        "taxId",
        "passportNumber",
        "governmentIdentifier",
        "visaNumber",
        "workAuthorizationDocumentNumber",
    };

    [GeneratedRegex(@"<\s*/?\s*[a-zA-Z][^>]*>", RegexOptions.CultureInvariant)]
    private static partial Regex HtmlTagPattern();
}

public sealed class StructuredDocumentException : Exception
{
    public StructuredDocumentException(string message)
        : base(message)
    {
    }
}
