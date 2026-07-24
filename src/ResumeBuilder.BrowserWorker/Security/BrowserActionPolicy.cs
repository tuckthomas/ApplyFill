using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Security;

public sealed record PolicyDecision(bool Allowed, string Code, string Message)
{
    public static PolicyDecision Permit() => new(true, "allowed", "Action is permitted.");
    public static PolicyDecision Deny(string code, string message) => new(false, code, message);
}

public sealed class DomainGraph
{
    private readonly ConcurrentDictionary<string, byte> _approvedHosts;

    public DomainGraph(IEnumerable<string> approvedHosts)
    {
        _approvedHosts = new ConcurrentDictionary<string, byte>(approvedHosts
            .Select(NormalizeHost)
            .Where(host => host.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(host => new KeyValuePair<string, byte>(host, 0)), StringComparer.OrdinalIgnoreCase);
    }

    public bool Contains(Uri uri)
    {
        if (uri.Scheme is not ("https" or "http")) return false;
        if (uri.UserInfo.Length > 0) return false;
        if (IPAddress.TryParse(uri.Host, out var address) && IsPrivateOrLocal(address)) return false;

        var host = NormalizeHost(uri.IdnHost);
        return _approvedHosts.Keys.Any(approved =>
            host.Equals(approved, StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith('.' + approved, StringComparison.OrdinalIgnoreCase));
    }

    public bool TryApproveTransition(Uri from, Uri to, IReadOnlySet<string> identityProviderHosts)
    {
        if (Contains(to)) return true;
        if (to.Scheme != "https") return false;
        var target = NormalizeHost(to.IdnHost);
        if (!identityProviderHosts.Any(host => target.Equals(NormalizeHost(host), StringComparison.OrdinalIgnoreCase))) return false;
        _approvedHosts.TryAdd(target, 0);
        return true;
    }

    private static string NormalizeHost(string host) => host.Trim().TrimEnd('.').ToLowerInvariant();

    private static bool IsPrivateOrLocal(IPAddress address)
    {
        if (IPAddress.IsLoopback(address)) return true;
        var bytes = address.GetAddressBytes();
        return address.AddressFamily switch
        {
            System.Net.Sockets.AddressFamily.InterNetwork =>
                bytes[0] == 10 ||
                bytes[0] == 127 ||
                bytes[0] == 169 && bytes[1] == 254 ||
                bytes[0] == 172 && bytes[1] is >= 16 and <= 31 ||
                bytes[0] == 192 && bytes[1] == 168,
            System.Net.Sockets.AddressFamily.InterNetworkV6 =>
                address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.Equals(IPAddress.IPv6Loopback),
            _ => true
        };
    }
}

public sealed class BrowserActionPolicy
{
    private static readonly HashSet<BrowserActionKind> SupportedKinds = Enum.GetValues<BrowserActionKind>().ToHashSet();
    private static readonly string[] LegalGateTerms =
    [
        "social security", "ssn", "government id", "national id", "passport",
        "mfa", "verification code", "captcha", "password", "security question",
        "race", "ethnicity", "veteran", "disability", "background check",
        "arbitration", "electronic signature", "certify", "attest"
    ];

    private static readonly string[] ImmediateHandoffTerms =
    [
        "mfa", "verification code", "captcha", "security question",
        "arbitration", "electronic signature", "certify", "attest"
    ];

    public PolicyDecision Validate(
        BrowserAction action,
        PageObservation observation,
        DomainGraph domainGraph,
        ControlOwner owner,
        ApprovedArtifact? artifact = null,
        bool perApplicationSensitiveApproval = false,
        bool finalSubmissionApproved = false)
    {
        ArgumentNullException.ThrowIfNull(action);
        ArgumentNullException.ThrowIfNull(observation);
        ArgumentNullException.ThrowIfNull(domainGraph);

        if (owner != ControlOwner.Agent)
            return PolicyDecision.Deny("agent-not-in-control", "The agent does not own browser control.");
        if (action.PageGeneration != observation.PageGeneration)
            return PolicyDecision.Deny("stale-observation", "The page changed after this action was proposed.");
        if (!SupportedKinds.Contains(action.Kind))
            return PolicyDecision.Deny("unsupported-action", "The requested browser action is not supported.");
        if (observation.ContainsSuspiciousInstructions)
            return PolicyDecision.Deny("suspicious-page-content", "The page contains instructions that require user review.");

        if (action.TargetUri is not null && !domainGraph.Contains(action.TargetUri))
            return PolicyDecision.Deny("domain-not-approved", "Navigation is outside the approved application flow.");

        if (action.Kind is BrowserActionKind.Navigate or BrowserActionKind.OpenTab)
        {
            if (action.TargetUri is null)
                return PolicyDecision.Deny("missing-target", "Navigation requires an approved URL.");
            return PolicyDecision.Permit();
        }

        if (action.Kind == BrowserActionKind.UploadApprovedArtifact)
        {
            if (action.ArtifactId is null || artifact is null || artifact.Id != action.ArtifactId)
                return PolicyDecision.Deny("artifact-not-approved", "Upload must reference the approved run artifact.");
            if (artifact.ExpiresAt <= observation.ObservedAt)
                return PolicyDecision.Deny("artifact-expired", "The approved upload artifact expired.");
            if (artifact.RunId == Guid.Empty || artifact.ByteLength is <= 0 or > 10 * 1024 * 1024)
                return PolicyDecision.Deny("artifact-invalid", "The upload artifact failed size or run validation.");
            if (!AllowedUploadType(artifact))
                return PolicyDecision.Deny("artifact-type-blocked", "Only approved PDF or DOCX application documents may be uploaded.");
        }

        if (action.Kind == BrowserActionKind.Wait && action.Delay is { } delay &&
            (delay < TimeSpan.Zero || delay > TimeSpan.FromSeconds(30)))
            return PolicyDecision.Deny("wait-out-of-range", "A wait must be between zero and 30 seconds.");

        if (action.Kind is BrowserActionKind.Scroll &&
            (Math.Abs(action.DeltaX ?? 0) > 10_000 || Math.Abs(action.DeltaY ?? 0) > 10_000))
            return PolicyDecision.Deny("scroll-out-of-range", "Scroll distance exceeds the allowed bound.");

        if (RequiresHandle(action.Kind))
        {
            if (string.IsNullOrWhiteSpace(action.Handle))
                return PolicyDecision.Deny("missing-handle", "This action requires a current visible-control handle.");
            var control = observation.Controls.FirstOrDefault(candidate => candidate.Handle == action.Handle);
            if (control is null)
                return PolicyDecision.Deny("unknown-handle", "The visible-control handle is not in the current observation.");
            if (!control.Enabled)
                return PolicyDecision.Deny("control-disabled", "The target control is disabled.");

            if (IsLegalOrSensitiveGate(control) && !perApplicationSensitiveApproval)
                return PolicyDecision.Deny("user-confirmation-required", "This answer requires confirmation for this application.");

            if (LooksLikeFinalSubmission(control) && !finalSubmissionApproved)
                return PolicyDecision.Deny("submission-approval-required", "Final submission requires explicit approval.");
        }

        if (action.Kind == BrowserActionKind.Type && (action.Value?.Length ?? 0) > 8_000)
            return PolicyDecision.Deny("value-too-large", "Typed values are limited to 8,000 characters.");

        return PolicyDecision.Permit();
    }

    public bool RequiresImmediateUserHandoff(PageObservation observation) =>
        observation.Kind is PageKind.Mfa or PageKind.Captcha ||
        observation.Controls.Any(IsCredentialOrLegalAttestationGate);

    public bool RequiresUserHandoff(
        PageObservation observation,
        IReadOnlyCollection<string>? approvedSensitiveFields = null) =>
        RequiresImmediateUserHandoff(observation) ||
        observation.Kind == PageKind.Login && observation.Controls.Any(control =>
            control.Required &&
            string.IsNullOrWhiteSpace(control.CurrentValue) &&
            IsLegalOrSensitiveGate(control) &&
            !IsApprovedSensitiveControl(control, approvedSensitiveFields)) ||
        observation.Controls.Any(control =>
            IsLegalOrSensitiveGate(control) &&
            string.IsNullOrWhiteSpace(control.CurrentValue) &&
            !IsApprovedSensitiveControl(control, approvedSensitiveFields));

    private static bool RequiresHandle(BrowserActionKind kind) => kind is
        BrowserActionKind.Focus or BrowserActionKind.Click or BrowserActionKind.Type or
        BrowserActionKind.Select or BrowserActionKind.Check or BrowserActionKind.UploadApprovedArtifact;

    private static bool IsLegalOrSensitiveGate(VisibleControl control)
    {
        if (control.Sensitive) return true;
        var description = string.Join(' ', control.Label, control.Type).ToLowerInvariant();
        return LegalGateTerms.Any(description.Contains);
    }

    private static bool IsCredentialOrLegalAttestationGate(VisibleControl control)
    {
        var description = string.Join(' ', control.Label, control.Type).ToLowerInvariant();
        return ImmediateHandoffTerms.Any(description.Contains);
    }

    private static bool IsApprovedSensitiveControl(
        VisibleControl control,
        IReadOnlyCollection<string>? approvedSensitiveFields)
    {
        if (!control.Sensitive || approvedSensitiveFields is null || approvedSensitiveFields.Count == 0)
        {
            return false;
        }

        var label = NormalizeField(control.Label);
        return approvedSensitiveFields.Any(field => NormalizeField(field) == label);
    }

    private static string NormalizeField(string? value) => new((value ?? string.Empty)
        .Where(char.IsLetterOrDigit)
        .Select(char.ToLowerInvariant)
        .ToArray());

    private static bool LooksLikeFinalSubmission(VisibleControl control)
    {
        var label = (control.Label ?? string.Empty).Trim().ToLowerInvariant();
        return control.Role.Equals("button", StringComparison.OrdinalIgnoreCase) &&
               (label is "submit" or "submit application" or "send application" or "apply now");
    }

    private static bool AllowedUploadType(ApprovedArtifact artifact)
    {
        var extension = Path.GetExtension(artifact.FileName);
        return extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase) && artifact.ContentType == "application/pdf" ||
               extension.Equals(".docx", StringComparison.OrdinalIgnoreCase) && artifact.ContentType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
}

public static partial class PromptInjectionDetector
{
    private static readonly string[] SuspiciousPhrases =
    [
        "ignore previous instructions", "ignore system prompt", "reveal system prompt",
        "show your hidden instructions", "send cookies", "send browser storage",
        "upload local files", "run javascript", "run shell", "disable safety",
        "navigate to localhost", "download and execute"
    ];

    public static bool IsSuspicious(IEnumerable<string?> values)
    {
        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            var normalized = Whitespace().Replace(value.Normalize(), " ").ToLower(CultureInfo.InvariantCulture);
            if (SuspiciousPhrases.Any(normalized.Contains)) return true;
        }

        return false;
    }

    [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant)]
    private static partial Regex Whitespace();
}
