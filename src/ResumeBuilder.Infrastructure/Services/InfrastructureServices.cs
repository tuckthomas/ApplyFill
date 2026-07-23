using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using ResumeBuilder.Application.Common;

namespace ResumeBuilder.Infrastructure.Services;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public sealed class GuidIdentifierGenerator : IIdentifierGenerator
{
    public Guid NewId() => Guid.CreateVersion7();
}

public sealed class LocalInstallation : ICurrentInstallation
{
    public LocalInstallation(IOptions<LocalInstallationOptions> options)
    {
        if (options.Value.Id != Guid.Empty)
        {
            Id = options.Value.Id;
            return;
        }

        var path = Path.GetFullPath(options.Value.IdentityPath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path))
        {
            var existing = File.ReadAllText(path).Trim();
            Id = Guid.TryParse(existing, out var parsed) && parsed != Guid.Empty
                ? parsed
                : throw new InvalidOperationException(
                    "The local installation identity is damaged. Restore it from backup or remove it to create a new local installation.");
            return;
        }

        Id = Guid.CreateVersion7();
        var temporary = path + ".part";
        File.WriteAllText(temporary, Id.ToString("D", System.Globalization.CultureInfo.InvariantCulture));
        File.Move(temporary, path, overwrite: false);
    }

    public Guid Id { get; }
}

public sealed class DataProtectionSensitiveValueProtector(IDataProtectionProvider provider) : ISensitiveValueProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("ApplyFill.SensitiveValues.v1");

    public string Protect(string plaintext)
    {
        ArgumentNullException.ThrowIfNull(plaintext);
        return _protector.Protect(plaintext);
    }

    public string Unprotect(string protectedValue)
    {
        ArgumentNullException.ThrowIfNull(protectedValue);
        try
        {
            return _protector.Unprotect(protectedValue);
        }
        catch (CryptographicException exception)
        {
            throw new SensitiveValueUnavailableException(
                "Sensitive information cannot be unlocked with this installation key. Restore the matching local key backup or replace the value.",
                exception);
        }
    }
}

public sealed class SensitiveValueUnavailableException : Exception
{
    public SensitiveValueUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

public sealed class LocalArtifactStore(IOptions<ArtifactStorageOptions> options) : IArtifactStore
{
    private readonly string _root = Path.GetFullPath(options.Value.RootPath);

    public async Task<StoredArtifact> PutAsync(
        Guid ownerId,
        Guid artifactId,
        string fileName,
        string mediaType,
        Stream content,
        long maximumBytes,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(mediaType);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maximumBytes);

        var ownerDirectory = Path.Combine(_root, ownerId.ToString("N"));
        Directory.CreateDirectory(ownerDirectory);
        var storageKey = $"{ownerId:N}/{artifactId:N}.bin";
        var destination = Resolve(storageKey);
        var temporary = destination + ".part";

        long total = 0;
        using var hasher = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        await using (var output = new FileStream(
            temporary,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            81_920,
            FileOptions.Asynchronous | FileOptions.SequentialScan))
        {
            var buffer = new byte[81_920];
            int read;
            while ((read = await content.ReadAsync(buffer, cancellationToken)) > 0)
            {
                total += read;
                if (total > maximumBytes)
                {
                    output.Close();
                    File.Delete(temporary);
                    throw new InvalidOperationException($"The artifact exceeds the {maximumBytes}-byte limit.");
                }

                hasher.AppendData(buffer, 0, read);
                await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }
        }

        File.Move(temporary, destination, overwrite: false);
        return new StoredArtifact(storageKey, total, Convert.ToHexString(hasher.GetHashAndReset()).ToLowerInvariant());
    }

    public Task<Stream?> OpenReadAsync(Guid ownerId, string storageKey, CancellationToken cancellationToken)
    {
        if (!storageKey.StartsWith($"{ownerId:N}/", StringComparison.Ordinal))
        {
            return Task.FromResult<Stream?>(null);
        }

        var path = Resolve(storageKey);
        Stream? stream = File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81_920, FileOptions.Asynchronous)
            : null;
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(Guid ownerId, string storageKey, CancellationToken cancellationToken)
    {
        if (!storageKey.StartsWith($"{ownerId:N}/", StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        var path = Resolve(storageKey);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        return Task.CompletedTask;
    }

    private string Resolve(string storageKey)
    {
        var relative = storageKey.Replace('/', Path.DirectorySeparatorChar);
        var path = Path.GetFullPath(Path.Combine(_root, relative));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;
        if (!path.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Artifact path escaped the configured storage root.");
        }

        return path;
    }
}

public sealed class LocalInstallationOptions
{
    public const string SectionName = "ApplyFill:Installation";

    public Guid Id { get; set; }

    public string IdentityPath { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ApplyFill",
        "installation-id");
}

public sealed class ArtifactStorageOptions
{
    public const string SectionName = "ApplyFill:Artifacts";

    public string RootPath { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ApplyFill",
        "artifacts");
}

public sealed class SensitiveDataKeyOptions
{
    public const string SectionName = "ApplyFill:DataProtection";

    public string KeyPath { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ApplyFill",
        "keys");
}
