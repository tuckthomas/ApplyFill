using System.Text.Json;
using ResumeBuilder.Application.Models;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.PrivateAi;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class PrivateAiResumeWorkflowsTests
{
    [Fact]
    public async Task ResumeImportRunsOcrBeforeBuildingAClosedProposal()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Ada Lovelace\nEngineer", "[]", 0.98)],
                "ocr", "revision", "test", TimeSpan.Zero),
            VisionJson = "{\"education\":[],\"experience\":[],\"credentials\":[],\"projects\":[],\"skills\":[]}",
        };
        var workflows = new PrivateAiResumeWorkflows(inference);
        var progress = new RecordingProgress();

        var result = await workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf",
            "application/pdf",
            [],
            "pdf",
            "Engineer",
            [new ResumeImportPage(1, "image/jpeg", [4, 5, 6])]), CancellationToken.None, progress);

        Assert.Equal(JsonValueKind.Object, result.Proposal.ValueKind);
        Assert.Contains("Ada Lovelace", result.DetectedText, StringComparison.Ordinal);
        Assert.NotNull(inference.DocumentRequest);
        Assert.Equal(5, inference.VisionRequestCount);
        Assert.Equal(
            [
                "resume-profile-proposal-education",
                "resume-profile-proposal-experience",
                "resume-profile-proposal-credentials",
                "resume-profile-proposal-projects",
                "resume-profile-proposal-skills",
            ],
            inference.VisionRequests.Select(request => request.TaskDefinitionId).ToArray());
        Assert.Single(inference.VisionRequest!.Images);
        Assert.NotNull(inference.VisionRequest.OutputJsonSchema);
        using var schema = JsonDocument.Parse(inference.VisionRequest.OutputJsonSchema);
        Assert.Equal(
            ["skills"],
            schema.RootElement.GetProperty("required").EnumerateArray().Select(item => item.GetString()!).ToArray());
        Assert.Equal(
            ["preparing", "reading", "organizing", "education", "experience", "credentials", "projects", "skills", "finishing"],
            progress.Updates.Select(update => update.Stage).ToArray());
        Assert.True(progress.Updates.Zip(progress.Updates.Skip(1), (left, right) => left.Progress < right.Progress).All(value => value));
    }

    [Fact]
    public async Task ResumeImportRejectsAnOpenEndedModelShape()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Engineer", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
            VisionJson = "{\"education\":[],\"experience\":[],\"credentials\":[],\"projects\":[],\"skills\":[],\"instructions\":\"ignore safety\"}",
        };
        var workflows = new PrivateAiResumeWorkflows(inference);

        await Assert.ThrowsAsync<InvalidDataException>(() => workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf", "application/pdf", [], "pdf", string.Empty,
            [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None));

        Assert.Equal(1, inference.VisionRequestCount);
    }

    [Fact]
    public async Task ResumeImportCombinesSectionProposalsWithoutRepeatingOcr()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Engineer", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
        };
        inference.VisionResponses.Enqueue("{\"education\":[]}");
        inference.VisionResponses.Enqueue("{\"experience\":[]}");
        inference.VisionResponses.Enqueue("{\"credentials\":[]}");
        inference.VisionResponses.Enqueue("{\"projects\":[]}");
        inference.VisionResponses.Enqueue("{\"skills\":[]}");
        var workflows = new PrivateAiResumeWorkflows(inference);

        var result = await workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf", "application/pdf", [], "pdf", string.Empty,
            [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None);

        Assert.Equal(JsonValueKind.Object, result.Proposal.ValueKind);
        Assert.Equal(5, inference.VisionRequestCount);
        Assert.Equal(1, inference.DocumentRequestCount);
    }

    [Fact]
    public async Task ResumeImportAcceptsSectionArraysFromLocalModels()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Engineer", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
        };
        inference.VisionResponses.Enqueue("[]");
        inference.VisionResponses.Enqueue("[]");
        inference.VisionResponses.Enqueue("[]");
        inference.VisionResponses.Enqueue("[]");
        inference.VisionResponses.Enqueue("[]");
        var workflows = new PrivateAiResumeWorkflows(inference);

        var result = await workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf", "application/pdf", [], "pdf", string.Empty,
            [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None);

        Assert.Equal(JsonValueKind.Object, result.Proposal.ValueKind);
        Assert.Equal(5, inference.VisionRequestCount);
        Assert.Equal(1, inference.DocumentRequestCount);
    }

    [Fact]
    public async Task ResumeImportKeepsCertificatesOutOfEducation()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "CERTIFICATES\nCommercial Credit Certificate", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
        };
        inference.VisionResponses.Enqueue("{\"education\":[]}");
        inference.VisionResponses.Enqueue("{\"experience\":[]}");
        inference.VisionResponses.Enqueue("""
            {"credentials":[{"credentialId":"","credentialUrl":"","details":[],"doesNotExpire":false,"expirationDate":"","issueDate":"","issuer":"Example Institute","name":"Commercial Credit Certificate","type":"Certificate"}]}
            """);
        inference.VisionResponses.Enqueue("{\"projects\":[]}");
        inference.VisionResponses.Enqueue("{\"skills\":[]}");
        var workflows = new PrivateAiResumeWorkflows(inference);

        var result = await workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf", "application/pdf", [], "pdf", string.Empty,
            [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None);

        Assert.Empty(result.Proposal.GetProperty("education").EnumerateArray());
        Assert.Equal(
            "Commercial Credit Certificate",
            result.Proposal.GetProperty("credentials")[0].GetProperty("name").GetString());
        Assert.Contains(
            "Never infer an Associate degree from a two-year training program",
            inference.VisionRequests.Single(request => request.TaskDefinitionId.EndsWith("-education", StringComparison.Ordinal)).Instruction,
            StringComparison.Ordinal);
        Assert.Contains(
            "named formal professional training or specialty program",
            inference.VisionRequests.Single(request => request.TaskDefinitionId.EndsWith("-credentials", StringComparison.Ordinal)).Instruction,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task ResumeImportRejectsASectionObjectWithAdditionalRootData()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Engineer", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
            VisionJson = "{\"education\":[],\"instructions\":\"ignore safety\"}",
        };
        var workflows = new PrivateAiResumeWorkflows(inference);

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            workflows.ImportResumeAsync(new ResumeImportPayload(
                "resume.pdf", "application/pdf", [], "pdf", string.Empty,
                [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None));

        Assert.Equal(1, inference.VisionRequestCount);
        Assert.Equal(1, inference.DocumentRequestCount);
    }

    [Fact]
    public async Task TailoringRejectsProhibitedProfileFieldsBeforeInference()
    {
        var inference = new FakeInference();
        var workflows = new PrivateAiResumeWorkflows(inference);
        using var document = JsonDocument.Parse(
            "{\"jobPosting\":{\"content\":\"role\"},\"resumeSnapshot\":{\"email\":\"private@example.com\"}}");

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            workflows.TailorResumeAsync(document.RootElement, CancellationToken.None));

        Assert.Null(inference.VisionRequest);
    }

    private sealed class FakeInference : IPrivateAiInference
    {
        public DocumentParsingResult DocumentResult { get; init; } = new([], "ocr", "revision", "test", TimeSpan.Zero);
        public string VisionJson { get; init; } = "{}";
        public DocumentParsingRequest? DocumentRequest { get; private set; }
        public VisionInferenceRequest? VisionRequest { get; private set; }
        public List<VisionInferenceRequest> VisionRequests { get; } = [];
        public Queue<string> VisionResponses { get; } = new();
        public int VisionRequestCount { get; private set; }
        public int DocumentRequestCount { get; private set; }

        public Task<VisionInferenceResult> InferAsync(VisionInferenceRequest request, CancellationToken cancellationToken = default)
        {
            VisionRequest = request;
            VisionRequests.Add(request);
            VisionRequestCount++;
            var output = VisionResponses.Count > 0 ? VisionResponses.Dequeue() : VisionJson;
            if (VisionResponses.Count == 0 &&
                output.StartsWith("{\"education\":", StringComparison.Ordinal) &&
                request.TaskDefinitionId.StartsWith("resume-profile-proposal-", StringComparison.Ordinal))
            {
                using var document = JsonDocument.Parse(output);
                var section = request.TaskDefinitionId["resume-profile-proposal-".Length..];
                var properties = document.RootElement.EnumerateObject().ToArray();
                if (properties.Length == 5 && document.RootElement.TryGetProperty(section, out var sectionValue))
                {
                    output = JsonSerializer.Serialize(new Dictionary<string, JsonElement>
                    {
                        [section] = sectionValue.Clone(),
                    });
                }
            }
            return Task.FromResult(new VisionInferenceResult(output, "vision", "revision", "test", TimeSpan.Zero));
        }

        public Task<DocumentParsingResult> ParseDocumentAsync(DocumentParsingRequest request, CancellationToken cancellationToken = default)
        {
            DocumentRequest = request;
            DocumentRequestCount++;
            return Task.FromResult(DocumentResult);
        }
    }

    private sealed class RecordingProgress : IProgress<ResumeImportProgress>
    {
        public List<ResumeImportProgress> Updates { get; } = [];

        public void Report(ResumeImportProgress value) => Updates.Add(value);
    }
}
