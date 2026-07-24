using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace ResumeBuilder.Infrastructure.Services;

public interface ICredentialVaultService
{
    byte[] CreateKey(string password, byte[] salt);
    string Encrypt(byte[] key, string plaintext, string context);
    bool TryDecrypt(byte[] key, string ciphertext, string context, out string plaintext);
    void Unlock(Guid ownerId, byte[] key);
    void Lock(Guid ownerId);
    bool IsUnlocked(Guid ownerId);
    string Encrypt(Guid ownerId, string plaintext, string context);
    string Decrypt(Guid ownerId, string ciphertext, string context);
}

public sealed class CredentialVaultService : ICredentialVaultService
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromMinutes(30);
    private readonly ConcurrentDictionary<Guid, VaultSession> _sessions = new();

    public byte[] CreateKey(string password, byte[] salt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);
        if (password.Length < 12) throw new ArgumentException("The vault password must contain at least 12 characters.");
        using var argon = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = Math.Clamp(Environment.ProcessorCount, 1, 4),
            Iterations = 3,
            MemorySize = 64 * 1024,
        };
        return argon.GetBytes(32);
    }

    public string Encrypt(byte[] key, string plaintext, string context)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var data = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[data.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(key, tag.Length);
        aes.Encrypt(nonce, data, cipher, tag, Encoding.UTF8.GetBytes(context));
        return Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public bool TryDecrypt(byte[] key, string ciphertext, string context, out string plaintext)
    {
        try
        {
            var payload = Convert.FromBase64String(ciphertext);
            if (payload.Length < 28) throw new CryptographicException();
            var output = new byte[payload.Length - 28];
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(payload[..12], payload[28..], payload[12..28], output, Encoding.UTF8.GetBytes(context));
            plaintext = Encoding.UTF8.GetString(output);
            return true;
        }
        catch (Exception exception) when (exception is CryptographicException or FormatException)
        {
            plaintext = string.Empty;
            return false;
        }
    }

    public void Unlock(Guid ownerId, byte[] key)
    {
        Lock(ownerId);
        _sessions[ownerId] = new VaultSession(key, DateTimeOffset.UtcNow.Add(SessionLifetime));
    }

    public void Lock(Guid ownerId)
    {
        if (_sessions.TryRemove(ownerId, out var session)) CryptographicOperations.ZeroMemory(session.Key);
    }

    public bool IsUnlocked(Guid ownerId) => TryGetKey(ownerId, out _);

    public string Encrypt(Guid ownerId, string plaintext, string context) =>
        Encrypt(RequireKey(ownerId), plaintext, context);

    public string Decrypt(Guid ownerId, string ciphertext, string context)
    {
        if (!TryDecrypt(RequireKey(ownerId), ciphertext, context, out var plaintext))
            throw new CryptographicException("The credential could not be decrypted.");
        return plaintext;
    }

    private byte[] RequireKey(Guid ownerId) =>
        TryGetKey(ownerId, out var key) ? key : throw new InvalidOperationException("Unlock the credential vault first.");

    private bool TryGetKey(Guid ownerId, out byte[] key)
    {
        if (_sessions.TryGetValue(ownerId, out var session) && session.ExpiresAt > DateTimeOffset.UtcNow)
        {
            _sessions[ownerId] = session with { ExpiresAt = DateTimeOffset.UtcNow.Add(SessionLifetime) };
            key = session.Key;
            return true;
        }
        Lock(ownerId);
        key = [];
        return false;
    }

    private sealed record VaultSession(byte[] Key, DateTimeOffset ExpiresAt);
}
