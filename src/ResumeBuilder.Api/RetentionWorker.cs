using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;

namespace ResumeBuilder.Api;

public sealed partial class RetentionWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<RetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var clock = scope.ServiceProvider.GetRequiredService<IClock>();
                var retention = scope.ServiceProvider.GetRequiredService<IDataRetentionService>();
                var result = await retention.PurgeExpiredAsync(clock.UtcNow, stoppingToken);
                if (result.ArtifactsDeleted > 0 || result.RecoveryStatesDeleted > 0 ||
                    result.IdempotencyReceiptsDeleted > 0)
                {
                    LogExpiredDataRemoved(
                        logger,
                        result.ArtifactsDeleted,
                        result.RecoveryStatesDeleted,
                        result.IdempotencyReceiptsDeleted);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                LogRetentionFailure(logger, exception);
            }
        }
    }

    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Expired local data removed: {ArtifactCount} artifacts, {RecoveryStateCount} recovery states, and {ReceiptCount} command receipts.")]
    private static partial void LogExpiredDataRemoved(
        ILogger logger,
        int artifactCount,
        int recoveryStateCount,
        int receiptCount);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Warning,
        Message = "The local retention pass could not complete; it will retry later.")]
    private static partial void LogRetentionFailure(ILogger logger, Exception exception);
}
