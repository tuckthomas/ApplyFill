using System.Text.Json;
using System.Text.Json.Serialization;

namespace ResumeBuilder.PrivateAi.Catalog;

public sealed class PrivateAiCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    private readonly IReadOnlyList<PrivateAiModelManifest> _models;
    private readonly IReadOnlyDictionary<string, PrivateAiRuntimeManifest> _runtimes;

    private PrivateAiCatalog(
        IReadOnlyList<PrivateAiModelManifest> models,
        IReadOnlyDictionary<string, PrivateAiRuntimeManifest> runtimes)
    {
        _models = models;
        _runtimes = runtimes;
    }

    public IReadOnlyList<PrivateAiModelManifest> Models => _models;

    public static async Task<PrivateAiCatalog> LoadAsync(
        string catalogDirectory,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(catalogDirectory);
        if (!Directory.Exists(catalogDirectory))
        {
            throw new DirectoryNotFoundException($"Private AI catalog was not found: {catalogDirectory}");
        }

        var models = new List<PrivateAiModelManifest>();
        foreach (var path in Directory.EnumerateFiles(catalogDirectory, "model.*.json").Order())
        {
            await using var stream = File.OpenRead(path);
            var manifest = await JsonSerializer.DeserializeAsync<PrivateAiModelManifest>(
                stream,
                JsonOptions,
                cancellationToken);
            models.Add(Validate(manifest ?? throw new InvalidDataException($"Empty model manifest: {path}")));
        }

        var runtimes = new Dictionary<string, PrivateAiRuntimeManifest>(StringComparer.Ordinal);
        foreach (var path in Directory.EnumerateFiles(catalogDirectory, "runtime.*.json").Order())
        {
            await using var stream = File.OpenRead(path);
            var manifest = await JsonSerializer.DeserializeAsync<PrivateAiRuntimeManifest>(
                stream,
                JsonOptions,
                cancellationToken);
            var validated = Validate(manifest ?? throw new InvalidDataException($"Empty runtime manifest: {path}"));
            if (!runtimes.TryAdd(validated.Id, validated))
            {
                throw new InvalidDataException($"Duplicate runtime ID: {validated.Id}");
            }
        }

        if (models.Count == 0 || runtimes.Count == 0)
        {
            throw new InvalidDataException("Private AI catalog must contain at least one model and runtime.");
        }

        foreach (var model in models.Where(model => !runtimes.ContainsKey(model.RuntimeId)))
        {
            throw new InvalidDataException($"Model {model.Id} references unknown runtime {model.RuntimeId}.");
        }

        return new PrivateAiCatalog(models, runtimes);
    }

    public PrivateAiModelManifest ResolveModel(
        IEnumerable<string> requiredCapabilities,
        PrivateAiHardware hardware,
        PrivateAiPreference preference = PrivateAiPreference.Quality)
    {
        ArgumentNullException.ThrowIfNull(requiredCapabilities);
        ArgumentNullException.ThrowIfNull(hardware);

        var capabilities = requiredCapabilities.ToHashSet(StringComparer.Ordinal);
        if (capabilities.Count == 0)
        {
            throw new ArgumentException("At least one Private AI capability is required.", nameof(requiredCapabilities));
        }

        var candidates = _models
            .Where(model => capabilities.IsSubsetOf(model.Capabilities))
            .Where(model => model.MinimumSystemMemoryBytes <= hardware.SystemMemoryBytes)
            .Where(model => model.MinimumDedicatedVideoMemoryBytes <= hardware.DedicatedVideoMemoryBytes)
            .Where(model => _runtimes[model.RuntimeId].Platform.Equals(hardware.Platform, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (candidates.Count == 0)
        {
            throw new PrivateAiUnavailableException("No approved Private AI configuration is compatible with this computer.");
        }

        return preference switch
        {
            PrivateAiPreference.Speed => candidates.OrderBy(model => model.QualityTier).ThenBy(ModelBytes).First(),
            PrivateAiPreference.Balanced => candidates.OrderBy(model => Math.Abs(model.QualityTier - 2)).ThenBy(ModelBytes).First(),
            _ => candidates.OrderByDescending(model => model.QualityTier).ThenByDescending(ModelBytes).First(),
        };
    }

    public PrivateAiRuntimeManifest GetRuntime(string runtimeId) =>
        _runtimes.TryGetValue(runtimeId, out var runtime)
            ? runtime
            : throw new KeyNotFoundException($"Private AI runtime not found: {runtimeId}");

    private static long ModelBytes(PrivateAiModelManifest model) => model.Artifacts.Sum(artifact => artifact.Bytes);

    private static PrivateAiModelManifest Validate(PrivateAiModelManifest manifest)
    {
        ValidateCommon(manifest.SchemaVersion, manifest.Id, manifest.Revision, manifest.License, manifest.Artifacts);
        if (manifest.Capabilities.Count == 0 || manifest.InputModalities.Count == 0)
        {
            throw new InvalidDataException($"Model {manifest.Id} has no declared capability or input modality.");
        }

        if (manifest.ContextTokens is < 1024 or > 32768 || manifest.MaximumImagePixels <= 0)
        {
            throw new InvalidDataException($"Model {manifest.Id} has unsafe operating limits.");
        }

        return manifest;
    }

    private static PrivateAiRuntimeManifest Validate(PrivateAiRuntimeManifest manifest)
    {
        ValidateCommon(manifest.SchemaVersion, manifest.Id, manifest.Version, manifest.License, manifest.Artifacts);
        if (Path.GetFileName(manifest.EntryPoint) != manifest.EntryPoint)
        {
            throw new InvalidDataException($"Runtime {manifest.Id} has an invalid entry point.");
        }

        return manifest;
    }

    private static void ValidateCommon(
        int schemaVersion,
        string id,
        string revision,
        string license,
        IReadOnlyList<PrivateAiArtifact> artifacts)
    {
        if (schemaVersion != 1 || string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(revision) ||
            string.IsNullOrWhiteSpace(license) || artifacts.Count == 0)
        {
            throw new InvalidDataException("Private AI manifest is missing required metadata.");
        }

        foreach (var artifact in artifacts)
        {
            if (Path.GetFileName(artifact.FileName) != artifact.FileName || artifact.Bytes <= 0 ||
                artifact.Sha256.Length != 64 || artifact.Url.Scheme != Uri.UriSchemeHttps)
            {
                throw new InvalidDataException($"Manifest {id} contains an invalid artifact.");
            }
        }
    }
}

public sealed class PrivateAiUnavailableException(string message) : InvalidOperationException(message);
