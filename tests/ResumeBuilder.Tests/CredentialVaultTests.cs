using System.Security.Cryptography;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Tests;

public sealed class CredentialVaultTests
{
    [Fact]
    public void PasswordDerivedKeyEncryptsAndDecryptsCredential()
    {
        var service = new CredentialVaultService();
        var salt = RandomNumberGenerator.GetBytes(16);
        var key = service.CreateKey("correct horse battery staple", salt);
        var ciphertext = service.Encrypt(key, "secret-password", "credential:test");

        Assert.DoesNotContain("secret-password", ciphertext, StringComparison.Ordinal);
        Assert.True(service.TryDecrypt(key, ciphertext, "credential:test", out var plaintext));
        Assert.Equal("secret-password", plaintext);
    }

    [Fact]
    public void WrongPasswordCannotDecryptCredential()
    {
        var service = new CredentialVaultService();
        var salt = RandomNumberGenerator.GetBytes(16);
        var first = service.CreateKey("correct horse battery staple", salt);
        var second = service.CreateKey("another sufficiently long password", salt);
        var ciphertext = service.Encrypt(first, "secret-password", "credential:test");

        Assert.False(service.TryDecrypt(second, ciphertext, "credential:test", out _));
    }
}
