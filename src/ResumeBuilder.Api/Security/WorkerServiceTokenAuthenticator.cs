using System.Security.Cryptography;
using System.Text;

namespace ResumeBuilder.Api.Security;

public interface IWorkerServiceTokenAuthenticator
{
    bool IsConfigured { get; }

    bool IsAuthorized(string? suppliedToken);
}

public sealed class WorkerServiceTokenAuthenticator(IConfiguration configuration) : IWorkerServiceTokenAuthenticator
{
    private readonly string? _configuredToken = Environment.GetEnvironmentVariable("APPLYFILL_BROWSER_WORKER_TOKEN") ??
        configuration["ApplyFill:Worker:ServiceToken"];

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_configuredToken) &&
        _configuredToken.Length >= 32 &&
        !_configuredToken.StartsWith("replace-", StringComparison.OrdinalIgnoreCase);

    public bool IsAuthorized(string? suppliedToken)
    {
        if (!IsConfigured || string.IsNullOrEmpty(suppliedToken))
        {
            return false;
        }

        var expected = SHA256.HashData(Encoding.UTF8.GetBytes(_configuredToken!));
        var supplied = SHA256.HashData(Encoding.UTF8.GetBytes(suppliedToken));
        return CryptographicOperations.FixedTimeEquals(expected, supplied);
    }
}
