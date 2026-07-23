using System.Reflection;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Mvc;
using ResumeBuilder.Api;
using ResumeBuilder.Api.Controllers;
using ResumeBuilder.Api.Problems;
using ResumeBuilder.Application.BrowserRuns;
using ResumeBuilder.Application.Common;

namespace ResumeBuilder.Tests;

public sealed class ApplicationAndApiContractTests
{
    private static readonly string[] StartApplicationRunProperties =
        ["CompanyName", "JobApplicationId", "JobTitle", "ProfileId", "ResumeId", "Target"];

    [Fact]
    public void BrowserRunContractsAreProviderNeutralAndDoNotAcceptExecutableInstructions()
    {
        var referencedAssemblies = typeof(IApplicationRunService).Assembly.GetReferencedAssemblies();
        Assert.DoesNotContain(
            referencedAssemblies,
            assembly => assembly.Name?.Contains("Playwright", StringComparison.OrdinalIgnoreCase) == true);

        var contractTypes = new[]
        {
            typeof(IApplicationRunService),
            typeof(IBrowserSession),
            typeof(IBrowserSessionFactory),
            typeof(StartApplicationRun),
            typeof(BrowserSessionStartRequest),
        };
        var exposedTypes = contractTypes
            .SelectMany(type => type.GetMethods().SelectMany(method =>
                method.GetParameters().Select(parameter => parameter.ParameterType)
                    .Append(method.ReturnType)))
            .Append(typeof(StartApplicationRun))
            .Append(typeof(BrowserSessionStartRequest));
        Assert.DoesNotContain(
            exposedTypes,
            type => type.FullName?.Contains("Playwright", StringComparison.OrdinalIgnoreCase) == true);

        var startProperties = typeof(StartApplicationRun).GetProperties()
            .Select(property => property.Name)
            .Order(StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
            StartApplicationRunProperties,
            startProperties);
    }

    [Fact]
    public void RunFailureTypesMapToStableProblemDetailsCodes()
    {
        var runId = Guid.CreateVersion7();
        var cases = new (Exception Exception, int Status, ApplyFillProblemCode Code, string WireCode)[]
        {
            (new ConcurrencyConflictException("Profile", runId), StatusCodes.Status409Conflict,
                ApplyFillProblemCode.StaleResource, "stale-resource"),
            (new StaleApplicationRunException(runId), StatusCodes.Status409Conflict,
                ApplyFillProblemCode.StaleRun, "stale-run"),
            (new InvalidStateTransitionException("invalid"), StatusCodes.Status409Conflict,
                ApplyFillProblemCode.InvalidTransition, "invalid-transition"),
            (new ControlConflictException(runId), StatusCodes.Status409Conflict,
                ApplyFillProblemCode.ControlConflict, "control-conflict"),
            (new PolicyDeniedException("blocked"), StatusCodes.Status403Forbidden,
                ApplyFillProblemCode.PolicyDenied, "policy-denied"),
            (new BrowserRuntimeUnavailableException("offline"), StatusCodes.Status503ServiceUnavailable,
                ApplyFillProblemCode.BrowserUnavailable, "browser-unavailable"),
            (new ModelRuntimeUnavailableException("offline"), StatusCodes.Status503ServiceUnavailable,
                ApplyFillProblemCode.ModelUnavailable, "model-unavailable"),
            (new ApplicationRunRecoveryException(runId, "failed"), StatusCodes.Status503ServiceUnavailable,
                ApplyFillProblemCode.RecoveryFailed, "recovery-failed"),
        };

        foreach (var value in cases)
        {
            var problem = ApplyFillProblemMapper.Map(value.Exception);
            Assert.Equal(value.Status, problem.Status);
            Assert.Equal(value.Code, problem.Code);
            Assert.Equal(value.WireCode, problem.WireCode);
            Assert.Equal($"https://applyfill.local/problems/{value.WireCode}", problem.Type);
        }
    }

    [Fact]
    public async Task ExceptionHandlerWritesTypedProblemDetailsWithoutLeakingExceptionText()
    {
        var problemDetails = new CapturingProblemDetailsService();
        var handler = new ApplyFillExceptionHandler(problemDetails);
        var context = new DefaultHttpContext();
        const string privateMessage = "private browser diagnostic";

        var handled = await handler.TryHandleAsync(
            context,
            new BrowserRuntimeUnavailableException(privateMessage),
            TestContext.Current.CancellationToken);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, context.Response.StatusCode);
        var captured = Assert.IsType<ProblemDetailsContext>(problemDetails.Captured);
        Assert.Equal("browser-unavailable", captured.ProblemDetails.Extensions["code"]);
        Assert.Equal("https://applyfill.local/problems/browser-unavailable", captured.ProblemDetails.Type);
        Assert.DoesNotContain(privateMessage, captured.ProblemDetails.Title, StringComparison.Ordinal);
        Assert.Null(captured.ProblemDetails.Detail);
    }

    [Fact]
    public void JsonCommandEndpointsDeclareBoundedRequestBodies()
    {
        Assert.Equal(32 * 1024, GetRequestLimit<ApplicationRunsController>(nameof(ApplicationRunsController.Create)));
        Assert.Equal(128 * 1024, GetRequestLimit<ApplicationRunsController>(nameof(ApplicationRunsController.AppendCheckpoint)));
        Assert.Equal(1_048_576, GetRequestLimit<ResumesController>(nameof(ResumesController.Create)));
        Assert.Equal(1_048_576, GetRequestLimit<ResumesController>(nameof(ResumesController.Update)));
        Assert.Equal(512 * 1024, GetRequestLimit<JobApplicationsController>(nameof(JobApplicationsController.Create)));
        Assert.Equal(512 * 1024, GetRequestLimit<JobApplicationsController>(nameof(JobApplicationsController.Update)));
        Assert.Equal(16 * 1024, GetRequestLimit<SensitiveAnswerApprovalsController>(nameof(SensitiveAnswerApprovalsController.Decide)));
        Assert.Equal(256 * 1024, GetRequestLimit<SettingsController>(nameof(SettingsController.Put)));
    }

    private static long GetRequestLimit<TController>(string methodName)
    {
        var method = typeof(TController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public);
        var limit = method?.GetCustomAttribute<RequestSizeLimitAttribute>();
        return Assert.IsAssignableFrom<IRequestSizeLimitMetadata>(limit).MaxRequestBodySize ?? 0;
    }

    private sealed class CapturingProblemDetailsService : IProblemDetailsService
    {
        public ProblemDetailsContext? Captured { get; private set; }

        public ValueTask WriteAsync(ProblemDetailsContext context)
        {
            Captured = context;
            return ValueTask.CompletedTask;
        }

        public ValueTask<bool> TryWriteAsync(ProblemDetailsContext context)
        {
            Captured = context;
            return ValueTask.FromResult(true);
        }
    }
}
