using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using ResumeBuilder.Api.Problems;

namespace ResumeBuilder.Api;

public sealed class ApplyFillExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problem = ApplyFillProblemMapper.Map(exception);

        httpContext.Response.StatusCode = problem.Status;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = problem.Status,
                Title = problem.Title,
                Type = problem.Type,
                Extensions = { ["code"] = problem.WireCode },
            },
        });
    }
}
