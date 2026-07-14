using System.Security.Claims;

namespace ResumeBuilder.Api.Middleware;

public class DevelopmentAuthMiddleware
{
    private readonly RequestDelegate _next;

    public DevelopmentAuthMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var devUserId = "00000000-0000-0000-0000-000000000001";
        
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, devUserId),
            new Claim(ClaimTypes.Name, "Developer"),
            new Claim(ClaimTypes.Email, "dev@local")
        };

        var identity = new ClaimsIdentity(claims, "DevAuth");
        context.User = new ClaimsPrincipal(identity);

        await _next(context);
    }
}

public static class DevelopmentAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseDevelopmentAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<DevelopmentAuthMiddleware>();
    }
}
