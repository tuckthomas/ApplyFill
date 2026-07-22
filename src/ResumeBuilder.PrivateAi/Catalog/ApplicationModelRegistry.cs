using ResumeBuilder.Application.Models;

namespace ResumeBuilder.PrivateAi.Catalog;

public sealed class ApplicationModelRegistry : IModelRegistry, IModelResolver
{
    private readonly IReadOnlyList<ModelDescriptor> _models;

    public ApplicationModelRegistry(PrivateAiCatalog catalog)
    {
        ArgumentNullException.ThrowIfNull(catalog);
        _models = catalog.Models.Select(ToDescriptor).ToList();
    }

    public IReadOnlyList<ModelDescriptor> List() => _models;

    public ModelDescriptor? Find(string id, string revision) => _models.FirstOrDefault(
        model => model.Id.Equals(id, StringComparison.Ordinal) &&
            model.Revision.Equals(revision, StringComparison.Ordinal));

    public ModelDescriptor Resolve(ModelSelectionRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var candidates = _models
            .Where(model => request.RequiredModalities.IsSubsetOf(model.Modalities))
            .Where(model => model.ApprovedTasks.Contains(request.ApprovedTask))
            .Where(model => model.Hardware.MinimumRamBytes <= request.AvailableRamBytes)
            .Where(model => model.Hardware.MinimumDedicatedGpuMemoryBytes is null ||
                model.Hardware.MinimumDedicatedGpuMemoryBytes <= request.AvailableGpuMemoryBytes)
            .Where(model => model.LifecycleState is ModelLifecycleState.Available or ModelLifecycleState.Ready)
            .ToList();
        if (candidates.Count == 0)
        {
            throw new PrivateAiUnavailableException("No approved Private AI model can perform this task on this computer.");
        }

        return request.PreferQuality
            ? candidates.OrderByDescending(model => ModelSizeRank(model.Id)).First()
            : candidates.OrderBy(model => ModelSizeRank(model.Id)).First();
    }

    private static ModelDescriptor ToDescriptor(PrivateAiModelManifest model)
    {
        var modalities = model.InputModalities.Select(ParseModality).ToHashSet();
        if (model.Capabilities.Contains("document-parsing", StringComparer.Ordinal))
        {
            modalities.Add(ModelModality.Document);
        }

        return new ModelDescriptor(
            model.Id,
            model.Revision,
            modalities,
            model.Capabilities.ToHashSet(StringComparer.Ordinal),
            model.RuntimeId,
            model.Quantization,
            model.ContextTokens,
            4,
            SupportsStructuredOutput: true,
            SupportsTools: false,
            new HardwareRequirements(
                model.MinimumSystemMemoryBytes,
                model.MinimumDedicatedVideoMemoryBytes,
                MinimumComputeCapability: "7.5",
                SupportsCpuOffload: true),
            model.License,
            string.Join(':', model.Artifacts.Select(artifact => artifact.Sha256)),
            ModelLifecycleState.Available);
    }

    private static ModelModality ParseModality(string modality) => modality switch
    {
        "text" => ModelModality.Text,
        "image" => ModelModality.Image,
        "document" => ModelModality.Document,
        _ => throw new InvalidDataException($"Unknown model modality: {modality}"),
    };

    private static int ModelSizeRank(string modelId) =>
        modelId.Contains("8b", StringComparison.OrdinalIgnoreCase) ? 3 :
        modelId.Contains("4b", StringComparison.OrdinalIgnoreCase) ? 2 : 1;
}
