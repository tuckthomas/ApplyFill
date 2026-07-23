using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Validation;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Api.Problems;

public enum ApplyFillProblemCode
{
    StaleResource,
    StaleRun,
    InvalidTransition,
    ControlConflict,
    PolicyDenied,
    BrowserUnavailable,
    ModelUnavailable,
    RecoveryFailed,
    InvalidDocument,
    SensitiveDataUnavailable,
    OperationUnavailable,
    InvalidValue,
    RequestFailed,
    InternalError,
}

public sealed record ApplyFillProblemDefinition(
    int Status,
    ApplyFillProblemCode Code,
    string WireCode,
    string Title)
{
    public string Type => $"https://applyfill.local/problems/{WireCode}";
}

public static class ApplyFillProblemMapper
{
    public static ApplyFillProblemDefinition Map(Exception? exception, int? fallbackStatus = null) => exception switch
    {
        ConcurrencyConflictException => Define(
            StatusCodes.Status409Conflict,
            ApplyFillProblemCode.StaleResource,
            "stale-resource",
            "The record changed. Reload it and try again."),
        StaleApplicationRunException => Define(
            StatusCodes.Status409Conflict,
            ApplyFillProblemCode.StaleRun,
            "stale-run",
            "The browser run changed. Reload it and try again."),
        InvalidStateTransitionException => Define(
            StatusCodes.Status409Conflict,
            ApplyFillProblemCode.InvalidTransition,
            "invalid-transition",
            "That command is not allowed in the run's current state."),
        ControlConflictException => Define(
            StatusCodes.Status409Conflict,
            ApplyFillProblemCode.ControlConflict,
            "control-conflict",
            "Control of this browser run changed. Reload it and try again."),
        PolicyDeniedException => Define(
            StatusCodes.Status403Forbidden,
            ApplyFillProblemCode.PolicyDenied,
            "policy-denied",
            "ApplyFill's safety policy blocked this operation."),
        BrowserRuntimeUnavailableException => Define(
            StatusCodes.Status503ServiceUnavailable,
            ApplyFillProblemCode.BrowserUnavailable,
            "browser-unavailable",
            "The private browser is unavailable."),
        ModelRuntimeUnavailableException => Define(
            StatusCodes.Status503ServiceUnavailable,
            ApplyFillProblemCode.ModelUnavailable,
            "model-unavailable",
            "Private AI is unavailable."),
        ApplicationRunRecoveryException => Define(
            StatusCodes.Status503ServiceUnavailable,
            ApplyFillProblemCode.RecoveryFailed,
            "recovery-failed",
            "ApplyFill could not recover the browser run."),
        StructuredDocumentException => Define(
            StatusCodes.Status400BadRequest,
            ApplyFillProblemCode.InvalidDocument,
            "invalid-document",
            "The structured document is invalid."),
        SensitiveValueUnavailableException => Define(
            StatusCodes.Status422UnprocessableEntity,
            ApplyFillProblemCode.SensitiveDataUnavailable,
            "sensitive-data-unavailable",
            "The requested sensitive value is unavailable."),
        InvalidOperationException => Define(
            StatusCodes.Status422UnprocessableEntity,
            ApplyFillProblemCode.OperationUnavailable,
            "operation-unavailable",
            "ApplyFill cannot complete that operation."),
        FormatException or ArgumentException => Define(
            StatusCodes.Status400BadRequest,
            ApplyFillProblemCode.InvalidValue,
            "invalid-value",
            "One or more values are invalid."),
        null when fallbackStatus is >= 500 => Define(
            fallbackStatus.Value,
            ApplyFillProblemCode.InternalError,
            "internal-error",
            "ApplyFill could not complete the request."),
        null => Define(
            fallbackStatus ?? StatusCodes.Status400BadRequest,
            ApplyFillProblemCode.RequestFailed,
            "request-failed",
            "The request could not be completed."),
        _ => Define(
            StatusCodes.Status500InternalServerError,
            ApplyFillProblemCode.InternalError,
            "internal-error",
            "ApplyFill could not complete the request."),
    };

    private static ApplyFillProblemDefinition Define(
        int status,
        ApplyFillProblemCode code,
        string wireCode,
        string title) => new(status, code, wireCode, title);
}
