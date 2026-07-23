namespace ResumeBuilder.Application.Models;

public enum ModelModality
{
    Text,
    Image,
    Document,
}

public enum ModelLifecycleState
{
    Available,
    Downloading,
    Ready,
    Unsupported,
    Disabled,
}

public sealed record HardwareRequirements(
    long MinimumRamBytes,
    long? MinimumDedicatedGpuMemoryBytes,
    string? MinimumComputeCapability,
    bool SupportsCpuOffload);

public sealed record ModelDescriptor(
    string Id,
    string Revision,
    IReadOnlySet<ModelModality> Modalities,
    IReadOnlySet<string> ApprovedTasks,
    string Runtime,
    string Quantization,
    int ContextLimit,
    int MaximumImages,
    bool SupportsStructuredOutput,
    bool SupportsTools,
    HardwareRequirements Hardware,
    string License,
    string ArtifactSha256,
    ModelLifecycleState LifecycleState);

public sealed record ImageInput(
    ReadOnlyMemory<byte> Bytes,
    string MediaType,
    int? Width = null,
    int? Height = null);

public sealed record VisionInferenceRequest(
    string TaskDefinitionId,
    string TaskDefinitionVersion,
    string OutputSchemaVersion,
    string Instruction,
    IReadOnlyList<ImageInput> Images,
    string? ContextJson,
    int MaximumOutputTokens,
    string? OutputJsonSchema = null);

public sealed record VisionInferenceResult(
    string OutputJson,
    string ModelId,
    string ModelRevision,
    string Provider,
    TimeSpan Elapsed);

public interface IVisionInferenceProvider
{
    string ProviderId { get; }

    Task<VisionInferenceResult> InferAsync(VisionInferenceRequest request, CancellationToken cancellationToken);
}

public sealed record DocumentParsingRequest(
    string TaskDefinitionVersion,
    string OutputSchemaVersion,
    ReadOnlyMemory<byte> Document,
    string MediaType,
    string FileName,
    int MaximumPages,
    IReadOnlyList<DocumentPageInput>? Pages = null);

public sealed record DocumentPageInput(
    int PageNumber,
    ImageInput RenderedPage,
    string? EmbeddedText);

public sealed record ParsedDocumentPage(int PageNumber, string Text, string LayoutJson, double Confidence);

public sealed record DocumentParsingResult(
    IReadOnlyList<ParsedDocumentPage> Pages,
    string ModelId,
    string ModelRevision,
    string Provider,
    TimeSpan Elapsed);

public interface IDocumentParsingProvider
{
    string ProviderId { get; }

    Task<DocumentParsingResult> ParseAsync(DocumentParsingRequest request, CancellationToken cancellationToken);
}

public interface IModelRegistry
{
    IReadOnlyList<ModelDescriptor> List();

    ModelDescriptor? Find(string id, string revision);
}

public interface IModelResolver
{
    ModelDescriptor Resolve(ModelSelectionRequest request);
}

public sealed record ModelSelectionRequest(
    IReadOnlySet<ModelModality> RequiredModalities,
    string ApprovedTask,
    bool PreferQuality,
    long AvailableRamBytes,
    long? AvailableGpuMemoryBytes,
    string? ComputeCapability);
