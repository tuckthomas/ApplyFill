using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Tests;

public sealed class SecurityAndValidationTests
{
    [Fact]
    public void StructuredDocumentsRejectRawHtml()
    {
        using var document = JsonDocument.Parse("{\"summary\":\"<script>alert(1)</script>\"}");

        var exception = Assert.Throws<StructuredDocumentException>(() =>
            StructuredJsonValidator.ValidateAndNormalize(document.RootElement));

        Assert.Contains("Raw HTML", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void SensitiveIdentifiersCannotEnterOrdinaryProfileJson()
    {
        using var document = JsonDocument.Parse("{\"personal\":{\"socialSecurityNumber\":\"000000000\"}}");

        Assert.Throws<StructuredDocumentException>(() =>
            StructuredJsonValidator.RejectSensitiveProfileFields(document.RootElement));
    }

    [Theory]
    [InlineData("+1 (317) 555-0123", "+13175550123")]
    [InlineData("44 20 7946 0958", "+442079460958")]
    public void PhoneNumbersAreStoredInInternationalForm(string input, string expected) =>
        Assert.Equal(expected, ProfileValueNormalizer.NormalizeInternationalPhone(input));

    [Fact]
    public void SensitiveValuesRoundTripAndFailWithTheWrongKey()
    {
        var first = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        var second = new DataProtectionSensitiveValueProtector(new EphemeralDataProtectionProvider());
        var ciphertext = first.Protect("{\"nationalId\":\"secret\"}");

        Assert.Equal("{\"nationalId\":\"secret\"}", first.Unprotect(ciphertext));
        Assert.DoesNotContain("secret", ciphertext, StringComparison.Ordinal);
        Assert.Throws<SensitiveValueUnavailableException>(() => second.Unprotect(ciphertext));
    }
}
