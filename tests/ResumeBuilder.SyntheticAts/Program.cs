using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ResumeBuilder.SyntheticAts;

public static class SyntheticAtsApplication
{
    public static WebApplication Create(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddSingleton<SyntheticAtsStateStore>();
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            const string cookieName = "applyfill-synthetic-ats-session";
            if (!context.Request.Cookies.TryGetValue(cookieName, out var sessionId) ||
                string.IsNullOrWhiteSpace(sessionId))
            {
                sessionId = Guid.NewGuid().ToString("N");
                context.Response.Cookies.Append(cookieName, sessionId, new CookieOptions
                {
                    HttpOnly = true,
                    IsEssential = true,
                    SameSite = SameSiteMode.Lax
                });
            }

            context.Items[SyntheticAtsStateStore.SessionItemKey] = sessionId;
            await next();
        });

        app.MapGet("/", () => Results.Redirect("/apply/step/1"));
        app.MapGet("/apply/step/{step:int}", (int step, HttpContext context, SyntheticAtsStateStore store) =>
        {
            if (step is < 1 or > SyntheticAtsPages.StepCount)
            {
                return Results.NotFound();
            }

            var state = store.GetSnapshot(context);
            return Results.Content(SyntheticAtsPages.RenderStep(step, state), "text/html", Encoding.UTF8);
        });

        app.MapGet("/fixtures/frame", () => Results.Content(SyntheticAtsPages.RenderIframe(), "text/html", Encoding.UTF8));
        app.MapGet("/fixtures/popup", () => Results.Content(SyntheticAtsPages.RenderPopup(), "text/html", Encoding.UTF8));
        app.MapGet("/fixtures/unrelated", () => Results.Content(SyntheticAtsPages.RenderUnrelatedPage(), "text/html", Encoding.UTF8));
        app.MapGet("/fixtures/redirect", () => Results.Redirect("/apply/step/6?redirected=true"));
        app.MapGet("/download/sample-resume.txt", () => Results.File(
            Encoding.UTF8.GetBytes("Synthetic resume fixture. Contains no personal or production data."),
            "text/plain",
            "synthetic-resume.txt"));

        app.MapGet("/api/state", (HttpContext context, SyntheticAtsStateStore store) =>
            Results.Json(store.GetSnapshot(context)));

        app.MapPut("/api/state/{step:int}", async (
            int step,
            HttpContext context,
            SyntheticAtsStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (step is < 1 or > SyntheticAtsPages.StepCount)
            {
                return Results.BadRequest(new { error = "invalid-step" });
            }

            var update = await context.Request.ReadFromJsonAsync<StepStateUpdate>(cancellationToken);
            if (update is null)
            {
                return Results.BadRequest(new { error = "missing-state" });
            }

            store.Save(context, step, update.Values);
            return Results.NoContent();
        });

        app.MapPost("/api/events/{eventName}", (
            string eventName,
            HttpContext context,
            SyntheticAtsStateStore store) =>
        {
            store.RecordEvent(context, eventName);
            return Results.NoContent();
        });

        app.MapPost("/api/submissions/{mode}", (
            string mode,
            HttpContext context,
            SyntheticAtsStateStore store) =>
        {
            var result = store.AttemptSubmission(context, mode);
            return result.Status switch
            {
                SyntheticSubmissionStatus.Confirmed => Results.Json(result),
                SyntheticSubmissionStatus.Uncertain when result.AttemptCount == 1 =>
                    Results.Json(result, statusCode: StatusCodes.Status202Accepted),
                SyntheticSubmissionStatus.Uncertain =>
                    Results.Json(result, statusCode: StatusCodes.Status409Conflict),
                _ => Results.BadRequest(result)
            };
        });

        return app;
    }
}

public static class Program
{
    public static async Task Main(string[] args)
    {
        var app = SyntheticAtsApplication.Create(args);
        await app.RunAsync();
    }
}
