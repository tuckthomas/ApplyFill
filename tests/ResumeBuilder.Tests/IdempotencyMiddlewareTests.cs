using System.Text;
using Microsoft.AspNetCore.Http;
using ResumeBuilder.Api.Security;
using ResumeBuilder.Application.Common;

namespace ResumeBuilder.Tests;

public sealed class IdempotencyMiddlewareTests
{
    [Fact]
    public async Task ClientDisconnectAfterMutationDoesNotCancelOrAbandonReceiptCompletion()
    {
        using var disconnected = new CancellationTokenSource();
        var context = new DefaultHttpContext
        {
            RequestAborted = disconnected.Token,
        };
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/api/v1/resumes";
        context.Request.Headers["Idempotency-Key"] = "test-command-key";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{\"name\":\"Resume\"}"));
        context.Response.Body = new MemoryStream();
        var store = new RecordingIdempotencyStore();
        var middleware = new ApiIdempotencyMiddleware(async httpContext =>
        {
            httpContext.Response.StatusCode = StatusCodes.Status201Created;
            httpContext.Response.ContentType = "application/json";
            await httpContext.Response.WriteAsync("{\"id\":\"created\"}", CancellationToken.None);
            disconnected.Cancel();
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => middleware.InvokeAsync(
            context,
            new TestInstallation(),
            store));

        Assert.True(store.Completed);
        Assert.False(store.CompletionTokenWasCanceled);
        Assert.False(store.Abandoned);
        var replay = await store.AcquireAsync(
            TestInstallation.InstallationId,
            "test-command-key",
            HttpMethods.Post,
            "/api/v1/resumes",
            store.RequestHash!,
            TestContext.Current.CancellationToken);
        Assert.Equal(IdempotencyAcquireState.Replay, replay.State);
        Assert.Equal("{\"id\":\"created\"}", Encoding.UTF8.GetString(replay.Replay!.Body));
    }

    private sealed class TestInstallation : ICurrentInstallation
    {
        public static readonly Guid InstallationId = Guid.Parse("54f2df29-852b-4c85-acaa-edb981f80243");

        public Guid Id => InstallationId;
    }

    private sealed class RecordingIdempotencyStore : IApiIdempotencyStore
    {
        private IdempotencyReplay? _replay;

        public bool Abandoned { get; private set; }

        public bool Completed { get; private set; }

        public bool CompletionTokenWasCanceled { get; private set; }

        public string? RequestHash { get; private set; }

        public Task<IdempotencyAcquisition> AcquireAsync(
            Guid ownerId,
            string key,
            string method,
            string path,
            string requestHash,
            CancellationToken cancellationToken)
        {
            RequestHash = requestHash;
            return Task.FromResult(_replay is null
                ? new IdempotencyAcquisition(IdempotencyAcquireState.Acquired)
                : new IdempotencyAcquisition(IdempotencyAcquireState.Replay, _replay));
        }

        public Task CompleteAsync(
            Guid ownerId,
            string key,
            string requestHash,
            IdempotencyReplay response,
            CancellationToken cancellationToken)
        {
            Completed = true;
            CompletionTokenWasCanceled = cancellationToken.IsCancellationRequested;
            _replay = response;
            return Task.CompletedTask;
        }

        public Task AbandonAsync(
            Guid ownerId,
            string key,
            string requestHash,
            CancellationToken cancellationToken)
        {
            Abandoned = true;
            return Task.CompletedTask;
        }
    }
}
