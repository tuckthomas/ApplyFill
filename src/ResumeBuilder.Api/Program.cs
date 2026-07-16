using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Api.Middleware;
using ResumeBuilder.Domain.Entities;
using ResumeBuilder.Infrastructure;
using ResumeBuilder.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddInfrastructureServices(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddCors(options => options.AddPolicy("LocalFrontend", policy => policy
    .WithOrigins("http://127.0.0.1:5173", "http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddHttpClient<ResumeBuilder.Application.Services.IAiService, ResumeBuilder.Application.Services.GeminiAiService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseDevelopmentAuth();

    // Auto-migrate and seed dev user
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var devUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    if (!await db.Users.AnyAsync(u => u.Id == devUserId))
    {
        var devUser = new User
        {
            Id = devUserId,
            Email = "dev@local",
            Name = "Developer",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(devUser);
        await db.SaveChangesAsync();
    }
}

if (app.Environment.IsDevelopment()) app.UseCors("LocalFrontend");

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.Run();
