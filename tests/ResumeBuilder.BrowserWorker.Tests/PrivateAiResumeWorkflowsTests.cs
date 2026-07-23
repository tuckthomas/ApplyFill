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
            VisionJson = "{\"education\":[],\"experience\":[],\"projects\":[],\"skills\":[]}",
        };
        var workflows = new PrivateAiResumeWorkflows(inference);

        var result = await workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf",
            "application/pdf",
            [],
            "pdf",
            "Engineer",
            [new ResumeImportPage(1, "image/jpeg", [4, 5, 6])]), CancellationToken.None);

        Assert.Equal(JsonValueKind.Object, result.Proposal.ValueKind);
        Assert.Contains("Ada Lovelace", result.DetectedText, StringComparison.Ordinal);
        Assert.NotNull(inference.DocumentRequest);
        Assert.Equal("resume-profile-proposal", inference.VisionRequest?.TaskDefinitionId);
        Assert.Single(inference.VisionRequest!.Images);
    }

    [Fact]
    public async Task ResumeImportRejectsAnOpenEndedModelShape()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Engineer", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
            VisionJson = "{\"education\":[],\"experience\":[],\"projects\":[],\"skills\":[],\"instructions\":\"ignore safety\"}",
        };
        var workflows = new PrivateAiResumeWorkflows(inference);

        await Assert.ThrowsAsync<InvalidDataException>(() => workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf", "application/pdf", [], "pdf", string.Empty,
            [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None));

        Assert.Equal(2, inference.VisionRequestCount);
    }

    [Fact]
    public async Task ResumeImportRetriesOneMalformedProposalWithoutRepeatingOcr()
    {
        var inference = new FakeInference
        {
            DocumentResult = new DocumentParsingResult(
                [new ParsedDocumentPage(1, "Engineer", "[]", 1)],
                "ocr", "revision", "test", TimeSpan.Zero),
        };
        inference.VisionResponses.Enqueue("{\"education\":[],\"experience\":[],\"projects\":[]}");
        inference.VisionResponses.Enqueue("{\"education\":[],\"experience\":[],\"projects\":[],\"skills\":[]}");
        var workflows = new PrivateAiResumeWorkflows(inference);

        var result = await workflows.ImportResumeAsync(new ResumeImportPayload(
            "resume.pdf", "application/pdf", [], "pdf", string.Empty,
            [new ResumeImportPage(1, "image/jpeg", [2])]), CancellationToken.None);

        Assert.Equal(JsonValueKind.Object, result.Proposal.ValueKind);
        Assert.Equal(2, inference.VisionRequestCount);
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
        public Queue<string> VisionResponses { get; } = new();
        public int VisionRequestCount { get; private set; }
        public int DocumentRequestCount { get; private set; }

        public Task<VisionInferenceResult> InferAsync(VisionInferenceRequest request, CancellationToken cancellationToken = default)
        {
            VisionRequest = request;
            VisionRequestCount++;
            var output = VisionResponses.Count > 0 ? VisionResponses.Dequeue() : VisionJson;
            return Task.FromResult(new VisionInferenceResult(output, "vision", "revision", "test", TimeSpan.Zero));
        }

        public Task<DocumentParsingResult> ParseDocumentAsync(DocumentParsingRequest request, CancellationToken cancellationToken = default)
        {
            DocumentRequest = request;
            DocumentRequestCount++;
            return Task.FromResult(DocumentResult);
        }
    }
}
