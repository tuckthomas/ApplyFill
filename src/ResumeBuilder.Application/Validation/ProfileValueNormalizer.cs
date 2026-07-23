using System.Globalization;

namespace ResumeBuilder.Application.Validation;

public static class ProfileValueNormalizer
{
    public static string NormalizeInternationalPhone(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var digits = new string(value.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length is < 8 or > 15)
        {
            throw new FormatException("Phone numbers must include a country code and contain 8 to 15 digits.");
        }

        return $"+{digits}";
    }

    public static decimal NormalizeGpa(decimal value, decimal scale)
    {
        if (scale <= 0 || value < 0 || value > scale)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "GPA must be between zero and its scale.");
        }

        return decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    }

    public static string NormalizeUrl(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
        {
            throw new FormatException("Only absolute HTTP and HTTPS URLs are accepted.");
        }

        return uri.GetComponents(UriComponents.HttpRequestUrl, UriFormat.UriEscaped);
    }

    public static string NormalizeDate(DateOnly value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
