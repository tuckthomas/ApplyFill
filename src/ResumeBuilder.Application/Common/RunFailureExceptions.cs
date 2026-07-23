namespace ResumeBuilder.Application.Common;

public sealed class StaleApplicationRunException : Exception
{
    public StaleApplicationRunException(Guid runId)
        : base($"Application run '{runId}' is stale. Reload it and try again.")
    {
        RunId = runId;
    }

    public Guid RunId { get; }
}

public sealed class ControlConflictException : Exception
{
    public ControlConflictException(Guid runId)
        : base($"Application run '{runId}' is controlled by another actor.")
    {
        RunId = runId;
    }

    public Guid RunId { get; }
}

public sealed class PolicyDeniedException : Exception
{
    public PolicyDeniedException(string message)
        : base(message)
    {
    }
}

public sealed class BrowserRuntimeUnavailableException : Exception
{
    public BrowserRuntimeUnavailableException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

public sealed class ModelRuntimeUnavailableException : Exception
{
    public ModelRuntimeUnavailableException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

public sealed class ApplicationRunRecoveryException : Exception
{
    public ApplicationRunRecoveryException(Guid runId, string message, Exception? innerException = null)
        : base(message, innerException)
    {
        RunId = runId;
    }

    public Guid RunId { get; }
}
