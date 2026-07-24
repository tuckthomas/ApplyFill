using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ResumeBuilder.Application.Common;
using ResumeBuilder.Application.Persistence;
using ResumeBuilder.Application.Profiles;
using ResumeBuilder.Infrastructure.Health;
using ResumeBuilder.Infrastructure.Persistence;
using ResumeBuilder.Infrastructure.Services;

namespace ResumeBuilder.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddApplyFillInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("ApplyFill")
            ?? throw new InvalidOperationException("ConnectionStrings:ApplyFill is required.");

        services.AddOptions<LocalInstallationOptions>()
            .Bind(configuration.GetSection(LocalInstallationOptions.SectionName))
            .Validate(
                x => x.Id != Guid.Empty || !string.IsNullOrWhiteSpace(x.IdentityPath),
                "A local installation identity path is required when an ID is not supplied.")
            .ValidateOnStart();
        services.AddOptions<ArtifactStorageOptions>()
            .Bind(configuration.GetSection(ArtifactStorageOptions.SectionName))
            .Validate(x => !string.IsNullOrWhiteSpace(x.RootPath), "An artifact storage path is required.")
            .ValidateOnStart();
        services.AddOptions<SensitiveDataKeyOptions>()
            .Bind(configuration.GetSection(SensitiveDataKeyOptions.SectionName))
            .Validate(x => !string.IsNullOrWhiteSpace(x.KeyPath), "A data-protection key path is required.")
            .ValidateOnStart();

        services.AddPooledDbContextFactory<ApplyFillDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(ApplyFillDbContext).Assembly.FullName);
                npgsql.CommandTimeout(30);
            }));
        services.AddScoped(sp => sp.GetRequiredService<IDbContextFactory<ApplyFillDbContext>>().CreateDbContext());

        services.AddScoped<IProfileRepository, EfProfileRepository>();
        services.AddScoped<IProfileSourceResumeRepository, EfProfileSourceResumeRepository>();
        services.AddScoped<IResumeRepository, EfResumeRepository>();
        services.AddScoped<IResumeArtifactRepository, EfResumeArtifactRepository>();
        services.AddScoped<IJobApplicationRepository, EfJobApplicationRepository>();
        services.AddScoped<IApplicationRunRepository, EfApplicationRunRepository>();
        services.AddScoped<IRelevantAnswerSource, ProfileRelevantAnswerSource>();
        services.AddScoped<IDataRetentionService, DataRetentionService>();
        services.AddScoped<ISensitiveAnswerApprovalService, SensitiveAnswerApprovalService>();
        services.AddScoped<IApiIdempotencyStore, ApiIdempotencyStore>();
        services.AddScoped<IWorkerRunPersistence, WorkerRunPersistence>();
        services.AddScoped<IUserSettingRepository, EfUserSettingRepository>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IIdentifierGenerator, GuidIdentifierGenerator>();
        services.AddSingleton<ICurrentInstallation, LocalInstallation>();
        services.AddSingleton<IArtifactStore, LocalArtifactStore>();

        var keyPath = configuration[$"{SensitiveDataKeyOptions.SectionName}:KeyPath"];
        if (string.IsNullOrWhiteSpace(keyPath))
        {
            keyPath = new SensitiveDataKeyOptions().KeyPath;
        }

        Directory.CreateDirectory(keyPath);
        var dataProtection = services.AddDataProtection()
            .SetApplicationName("ApplyFill")
            .PersistKeysToFileSystem(new DirectoryInfo(keyPath));
        if (OperatingSystem.IsWindows())
        {
            dataProtection.ProtectKeysWithDpapi();
        }

        services.AddSingleton<ISensitiveValueProtector, DataProtectionSensitiveValueProtector>();
        services.AddSingleton<ICredentialVaultService, CredentialVaultService>();
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("postgresql", tags: ["ready"]);
        return services;
    }
}
