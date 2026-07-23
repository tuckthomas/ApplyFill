using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using ResumeBuilder.BrowserWorker.Orchestration;
using ResumeBuilder.BrowserWorker.Runtime;

namespace ResumeBuilder.BrowserWorker.Tests;

public sealed class ApiApprovedArtifactStoreTests
{
    [Fact]
    public async Task StagesLatestVerifiedResumeArtifactForExactRun()
    {
        var resumeId = Guid.NewGuid();
        var artifactId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var bytes = "%PDF-1.7\nreviewed"u8.ToArray();
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes));
        using var client = new HttpClient(new ArtifactHandler(resumeId, artifactId, bytes, sha256))
        {
            BaseAddress = new Uri("http://127.0.0.1:5180"),
        };
        var options = Options.Create(new ApplyFillApiOptions
        {
            BaseUri = client.BaseAddress,
            WorkerToken = new string('t', 32),
        });
        var store = new ApiApprovedArtifactStore(client, options, TimeProvider.System);

        var artifact = await store.GetLatestForRunAsync(runId, resumeId, CancellationToken.None);

        Assert.NotNull(artifact);
        Assert.Equal(artifactId, artifact.Id);
        Assert.Equal(runId, artifact.RunId);
        Assert.Equal("reviewed.pdf", artifact.FileName);
        Assert.Equal(bytes.Length, artifact.ByteLength);
        Assert.Equal(artifact, await store.GetVerifiedAsync(artifactId, runId, CancellationToken.None));
        Assert.Null(await store.GetVerifiedAsync(artifactId, Guid.NewGuid(), CancellationToken.None));

        await store.ReleaseRunAsync(runId, CancellationToken.None);
        Assert.False(File.Exists(artifact.StagedPath));
    }

    [Fact]
    public async Task ExpiredStagedArtifactIsRemovedDeterministically()
    {
        var resumeId = Guid.NewGuid();
        var artifactId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var bytes = "%PDF-1.7\nexpires"u8.ToArray();
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes));
        using var client = new HttpClient(new ArtifactHandler(resumeId, artifactId, bytes, sha256))
        {
            BaseAddress = new Uri("http://127.0.0.1:5180"),
        };
        var options = Options.Create(new ApplyFillApiOptions
        {
            BaseUri = client.BaseAddress,
            WorkerToken = new string('t', 32),
        });
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 7, 22, 12, 0, 0, TimeSpan.Zero));
        await using var store = new ApiApprovedArtifactStore(client, options, clock);
        var artifact = await store.GetLatestForRunAsync(runId, resumeId, CancellationToken.None);
        Assert.NotNull(artifact);
        Assert.True(File.Exists(artifact.StagedPath));

        clock.Advance(TimeSpan.FromHours(3));
        var expired = await store.GetVerifiedAsync(artifactId, runId, CancellationToken.None);

        Assert.Null(expired);
        Assert.False(File.Exists(artifact.StagedPath));
        Assert.False(Directory.Exists(Path.GetDirectoryName(artifact.StagedPath)));
    }

    private sealed class ArtifactHandler(
        Guid resumeId,
        Guid artifactId,
        byte[] bytes,
        string sha256) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            if (request.RequestUri?.AbsolutePath == $"/api/v1/resumes/{resumeId:D}/artifacts")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(new[]
                    {
                        new
                        {
                            id = artifactId,
                            resumeId,
                            fileName = "reviewed.pdf",
                            mediaType = "application/pdf",
                            sizeBytes = bytes.Length,
                            sha256,
                            createdAt = DateTimeOffset.UtcNow,
                        },
                    }),
                });
            }

            if (request.RequestUri?.AbsolutePath == $"/api/v1/resumes/{resumeId:D}/artifacts/{artifactId:D}/content")
            {
                var content = new ByteArrayContent(bytes);
                content.Headers.ContentType = new("application/pdf");
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = content });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }

    private sealed class ManualTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;

        public void Advance(TimeSpan elapsed) => utcNow += elapsed;
    }
}
