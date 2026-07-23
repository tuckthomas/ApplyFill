using Microsoft.AspNetCore.Mvc;

namespace ResumeBuilder.Api.Controllers;

[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid RequireConcurrencyToken()
    {
        var value = Request.Headers.IfMatch.ToString().Trim().Trim('"');
        if (!Guid.TryParse(value, out var token) || token == Guid.Empty)
        {
            throw new ArgumentException("A valid If-Match concurrency token is required.");
        }

        return token;
    }

    protected void SetConcurrencyToken(Guid token) => Response.Headers.ETag = $"\"{token:D}\"";
}
