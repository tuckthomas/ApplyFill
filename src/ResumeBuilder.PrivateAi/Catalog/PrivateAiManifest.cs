using System.Text.Json.Serialization;

namespace ResumeBuilder.PrivateAi.Catalog;

public sealed record PrivateAiArtifact(
    string Role,
    string FileName,
    long Bytes,
    string Sha256,
    Uri Url);

public sealed record PrivateAiModelManifest(
    int SchemaVersion,
    string Id,
    string DisplayName,
    string Repository,
    string Revision,
    string License,
    string RuntimeId,
    string Quantization,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<string> InputModalities,
    int QualityTier,
    long MinimumSystemMemoryBytes,
    long MinimumDedicatedVideoMemoryBytes,
    int ContextTokens,
    long MaximumImagePixels,
    IReadOnlyList<PrivateAiArtifact> Artifacts);

public sealed record PrivateAiRuntimeManifest(
    int SchemaVersion,
    string Id,
    string Version,
    string Platform,
    string Accelerator,
    string License,
    string EntryPoint,
    IReadOnlyList<PrivateAiArtifact> Artifacts);

public sealed record PrivateAiHardware(
    string Platform,
    long SystemMemoryBytes,
    long DedicatedVideoMemoryBytes);

[JsonConverter(typeof(JsonStringEnumConverter<PrivateAiPreference>))]
public enum PrivateAiPreference
{
    Quality,
    Balanced,
    Speed,
}
