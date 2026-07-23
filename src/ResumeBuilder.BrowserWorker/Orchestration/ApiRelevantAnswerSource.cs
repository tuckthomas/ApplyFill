using System.Collections.Concurrent;
using System.Collections.Immutable;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Contracts;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public sealed class ApplyFillApiOptions
{
    public const string SectionName = "ApplyFillApi";

    public Uri BaseUri { get; set; } = new("http://127.0.0.1:5180");

    public string WorkerToken { get; set; } = string.Empty;
}

public sealed class ApiRelevantAnswerSource(
    HttpClient httpClient,
    IOptions<ApplyFillApiOptions> options) : IRelevantAnswerSource, ISensitiveAnswerApprovalCoordinator
{
    private readonly ApplyFillApiOptions _options = ValidateOptions(options.Value);
    private readonly ConcurrentDictionary<(Guid RunId, string ControlId), SensitiveAnswerApprovalPrompt> _pending = new();
    private readonly ConcurrentDictionary<(Guid RunId, string ControlId), OneUseAnswer> _approved = new();

    public async Task<RelevantAnswerLookup> GetForVisibleControlsAsync(
        Guid runId,
        Guid profileId,
        IReadOnlyList<VisibleControl> controls,
        CancellationToken cancellationToken)
    {
        if (runId == Guid.Empty || profileId == Guid.Empty || controls.Count == 0)
        {
            return new RelevantAnswerLookup([]);
        }

        var boundedControls = controls
            .Where(control => !string.IsNullOrWhiteSpace(control.Handle) && !string.IsNullOrWhiteSpace(control.Label))
            .Take(100)
            .Select(control => new VisibleControlRequest(
                control.Handle,
                control.Label!,
                control.Role,
                Autocomplete: null,
                control.Options.Take(200).ToArray()))
            .ToArray();
        if (boundedControls.Length == 0)
        {
            return new RelevantAnswerLookup([]);
        }

        var labelsByControl = boundedControls.ToDictionary(
            control => control.ControlId,
            control => control.Label,
            StringComparer.Ordinal);
        var visibleByControl = controls.ToDictionary(control => control.Handle, StringComparer.Ordinal);
        var answers = ImmutableArray.CreateBuilder<RelevantAnswer>();

        // Approved plaintext is held only until a verified action completes for this
        // exact control. It is never included in an API request, checkpoint, prompt, or log.
        var hasApprovedVisibleAnswer = false;
        foreach (var control in boundedControls)
        {
            if (visibleByControl.TryGetValue(control.ControlId, out var visible) &&
                visible.Required &&
                visible.Enabled &&
                string.IsNullOrWhiteSpace(visible.CurrentValue) &&
                _approved.TryGetValue((runId, control.ControlId), out var approved))
            {
                answers.Add(new RelevantAnswer(approved.Field, approved.Value, Sensitive: true, ApprovedForThisApplication: true));
                hasApprovedVisibleAnswer = true;
            }
        }

        RelevantAnswersResponse? payload;
        using (var request = CreateUnsafe(
                   HttpMethod.Post,
                   "internal/v1/profile-answer-candidates",
                   $"answer-candidates:{Guid.CreateVersion7():N}",
                   new RelevantAnswersRequest(profileId, boundedControls)))
        {
            try
            {
                using var response = await httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    return new RelevantAnswerLookup(answers.ToImmutable());
                }

                payload = await response.Content.ReadFromJsonAsync<RelevantAnswersResponse>(cancellationToken);
            }
            catch (HttpRequestException)
            {
                return new RelevantAnswerLookup(answers.ToImmutable());
            }
            catch (JsonException)
            {
                return new RelevantAnswerLookup(answers.ToImmutable());
            }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return new RelevantAnswerLookup(answers.ToImmutable());
            }
        }

        if (payload?.Candidates is null)
        {
            return new RelevantAnswerLookup(answers.ToImmutable());
        }

        answers.AddRange(payload.Candidates
            .Where(candidate =>
                !candidate.IsSensitive &&
                candidate.Value is not null &&
                candidate.Confidence >= 0.45 &&
                labelsByControl.ContainsKey(candidate.ControlId))
            .GroupBy(candidate => candidate.ControlId, StringComparer.Ordinal)
            .Select(group => group.OrderByDescending(candidate => candidate.Confidence).First())
            .Select(candidate => new RelevantAnswer(
                labelsByControl[candidate.ControlId],
                candidate.Value!,
                Sensitive: false,
                ApprovedForThisApplication: candidate.IsApproved)));

        var sensitiveCandidate = hasApprovedVisibleAnswer
            ? null
            : payload.Candidates
            .Where(candidate =>
                candidate.IsSensitive &&
                candidate.RequiresApproval &&
                candidate.Confidence >= 0.45 &&
                labelsByControl.ContainsKey(candidate.ControlId) &&
                visibleByControl.TryGetValue(candidate.ControlId, out var control) &&
                control.Required &&
                control.Enabled &&
                string.IsNullOrWhiteSpace(control.CurrentValue))
            .OrderByDescending(candidate => candidate.Confidence)
            .FirstOrDefault();
        if (sensitiveCandidate is null)
        {
            return new RelevantAnswerLookup(answers.ToImmutable());
        }

        if (_pending.TryGetValue((runId, sensitiveCandidate.ControlId), out var existing))
        {
            return new RelevantAnswerLookup(answers.ToImmutable(), existing);
        }

        var pending = await RequestApprovalAsync(
            runId,
            profileId,
            sensitiveCandidate,
            labelsByControl[sensitiveCandidate.ControlId],
            cancellationToken);
        return new RelevantAnswerLookup(answers.ToImmutable(), pending);
    }

    public async Task<bool> ConsumeApprovedAsync(
        Guid runId,
        Guid approvalId,
        string controlId,
        CancellationToken cancellationToken)
    {
        if (!_pending.TryGetValue((runId, controlId), out var pending) || pending.ApprovalId != approvalId)
        {
            return false;
        }

        using var request = CreateUnsafe(
            HttpMethod.Post,
            $"api/internal/v1/sensitive-answer-approvals/{approvalId:D}/consume",
            $"sensitive-consume:{approvalId:N}",
            new ConsumeSensitiveApproval(runId, controlId));
        using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return false;
        }

        var consumed = await response.Content.ReadFromJsonAsync<ConsumedSensitiveAnswer>(cancellationToken);
        if (consumed is null || consumed.ApprovalId != approvalId ||
            !consumed.ControlId.Equals(controlId, StringComparison.Ordinal))
        {
            return false;
        }

        _pending.TryRemove((runId, controlId), out _);
        _approved[(runId, controlId)] = new OneUseAnswer(pending.Field, consumed.Value);
        return true;
    }

    public void Dismiss(Guid runId, Guid approvalId, string controlId)
    {
        if (_pending.TryGetValue((runId, controlId), out var pending) && pending.ApprovalId == approvalId)
        {
            _pending.TryRemove((runId, controlId), out _);
        }

        _approved.TryRemove((runId, controlId), out _);
    }

    public void MarkUsed(Guid runId, string controlId) =>
        _approved.TryRemove((runId, controlId), out _);

    public void ClearRun(Guid runId)
    {
        foreach (var key in _pending.Keys.Where(key => key.RunId == runId))
        {
            _pending.TryRemove(key, out _);
        }

        foreach (var key in _approved.Keys.Where(key => key.RunId == runId))
        {
            _approved.TryRemove(key, out _);
        }
    }

    private async Task<SensitiveAnswerApprovalPrompt?> RequestApprovalAsync(
        Guid runId,
        Guid profileId,
        RelevantAnswerCandidate candidate,
        string field,
        CancellationToken cancellationToken)
    {
        using var request = CreateUnsafe(
            HttpMethod.Post,
            "api/internal/v1/sensitive-answer-approvals",
            $"sensitive-request:{runId:N}:{StableToken(candidate.ControlId, candidate.SourcePath)}",
            new RequestSensitiveApproval(runId, profileId, candidate.ControlId, candidate.SourcePath, candidate.DisplayName));
        try
        {
            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var approval = await response.Content.ReadFromJsonAsync<SensitiveApprovalResponse>(cancellationToken);
            if (approval is null || approval.Id == Guid.Empty || approval.ConcurrencyToken == Guid.Empty)
            {
                return null;
            }

            var prompt = new SensitiveAnswerApprovalPrompt(
                approval.Id,
                approval.ConcurrencyToken,
                approval.ControlId,
                field,
                approval.DisplayName,
                approval.MaskedValue);
            _pending[(runId, candidate.ControlId)] = prompt;
            return prompt;
        }
        catch (HttpRequestException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return null;
        }
    }

    private HttpRequestMessage CreateUnsafe<T>(HttpMethod method, string path, string operationKey, T content)
    {
        var request = new HttpRequestMessage(method, path) { Content = JsonContent.Create(content) };
        request.Headers.Add("X-ApplyFill-Worker-Token", _options.WorkerToken);
        request.Headers.Add("X-ApplyFill-Request", "1");
        request.Headers.Add("Idempotency-Key", operationKey);
        return request;
    }

    public static HttpClient CreateHttpClient(ApplyFillApiOptions options)
    {
        ValidateOptions(options);
        return new HttpClient(new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.All,
            UseCookies = false,
        })
        {
            BaseAddress = options.BaseUri,
            Timeout = TimeSpan.FromSeconds(10),
        };
    }

    internal static ApplyFillApiOptions ValidateOptions(ApplyFillApiOptions options)
    {
        if (!options.BaseUri.IsAbsoluteUri ||
            options.BaseUri.Scheme != Uri.UriSchemeHttp ||
            !IsLoopbackHost(options.BaseUri.Host))
        {
            throw new InvalidOperationException("ApplyFillApi:BaseUri must be an absolute loopback HTTP address.");
        }

        if (options.WorkerToken.Length < 32)
        {
            throw new InvalidOperationException("ApplyFillApi:WorkerToken must be at least 32 characters.");
        }

        return options;
    }

    private static bool IsLoopbackHost(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
        IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address);

    private static string StableToken(string controlId, string sourcePath)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"{controlId}\n{sourcePath}"));
        return Convert.ToHexString(bytes).ToLowerInvariant()[..24];
    }

    private sealed record OneUseAnswer(string Field, string Value);
    private sealed record RelevantAnswersRequest(Guid ProfileId, IReadOnlyList<VisibleControlRequest> Controls);
    private sealed record VisibleControlRequest(
        string ControlId,
        string Label,
        string Role,
        string? Autocomplete,
        IReadOnlyList<string> Options);
    private sealed record RelevantAnswersResponse(IReadOnlyList<RelevantAnswerCandidate> Candidates);
    private sealed record RelevantAnswerCandidate(
        string ControlId,
        string SourcePath,
        string DisplayName,
        string? Value,
        string? MaskedValue,
        bool IsSensitive,
        bool IsApproved,
        bool RequiresApproval,
        double Confidence);
    private sealed record RequestSensitiveApproval(
        Guid RunId,
        Guid ProfileId,
        string ControlId,
        string SourcePath,
        string DisplayName);
    private sealed record ConsumeSensitiveApproval(Guid RunId, string ControlId);
    private sealed record ConsumedSensitiveAnswer(Guid ApprovalId, string ControlId, string Value);
    private sealed record SensitiveApprovalResponse(
        Guid Id,
        Guid RunId,
        string ControlId,
        string SourcePath,
        string DisplayName,
        string MaskedValue,
        int State,
        Guid ConcurrencyToken,
        DateTimeOffset CreatedAt,
        DateTimeOffset ExpiresAt,
        DateTimeOffset? DecidedAt,
        DateTimeOffset? ConsumedAt);
}
