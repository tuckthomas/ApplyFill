using Microsoft.EntityFrameworkCore;

namespace ResumeBuilder.Infrastructure.Persistence;

public sealed class ApplyFillDbContext(DbContextOptions<ApplyFillDbContext> options) : DbContext(options)
{
    public DbSet<ProfileRecord> Profiles => Set<ProfileRecord>();
    public DbSet<ResumeRecord> Resumes => Set<ResumeRecord>();
    public DbSet<ResumeArtifactRecord> ResumeArtifacts => Set<ResumeArtifactRecord>();
    public DbSet<JobApplicationRecord> JobApplications => Set<JobApplicationRecord>();
    public DbSet<ApplicationRunRecord> ApplicationRuns => Set<ApplicationRunRecord>();
    public DbSet<RunCheckpointRecord> RunCheckpoints => Set<RunCheckpointRecord>();
    public DbSet<AgentActionRecord> AgentActions => Set<AgentActionRecord>();
    public DbSet<PendingQuestionRecord> PendingQuestions => Set<PendingQuestionRecord>();
    public DbSet<UserDecisionRecord> UserDecisions => Set<UserDecisionRecord>();
    public DbSet<BrowserSessionRecord> BrowserSessions => Set<BrowserSessionRecord>();
    public DbSet<ArtifactRecord> Artifacts => Set<ArtifactRecord>();
    public DbSet<ModelEvaluationRecord> ModelEvaluations => Set<ModelEvaluationRecord>();
    public DbSet<SensitiveAnswerApprovalRecord> SensitiveAnswerApprovals => Set<SensitiveAnswerApprovalRecord>();
    public DbSet<ApiIdempotencyRecord> ApiIdempotencyRecords => Set<ApiIdempotencyRecord>();
    public DbSet<UserSettingRecord> UserSettings => Set<UserSettingRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureProfile(modelBuilder);
        ConfigureResume(modelBuilder);
        ConfigureJobApplication(modelBuilder);
        ConfigureApplicationRun(modelBuilder);
        ConfigureSupportingRecords(modelBuilder);
        ConfigureSensitiveApprovals(modelBuilder);
        ConfigureApiIdempotency(modelBuilder);
        ConfigureUserSettings(modelBuilder);
    }

    private static void ConfigureProfile(ModelBuilder builder)
    {
        var entity = builder.Entity<ProfileRecord>();
        entity.ToTable("profiles");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => x.OwnerId).IsUnique();
        entity.Property(x => x.ContentJson).HasColumnType("jsonb");
        entity.Property(x => x.ProtectedApplicationData).HasMaxLength(1_048_576);
        entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
    }

    private static void ConfigureResume(ModelBuilder builder)
    {
        var entity = builder.Entity<ResumeRecord>();
        entity.ToTable("resumes");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OwnerId, x.UpdatedAt });
        entity.Property(x => x.Name).HasMaxLength(160);
        entity.Property(x => x.ContentJson).HasColumnType("jsonb");
        entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();

        var artifact = builder.Entity<ResumeArtifactRecord>();
        artifact.ToTable("resume_artifacts");
        artifact.HasKey(x => x.Id);
        artifact.HasIndex(x => new { x.OwnerId, x.ResumeId });
        artifact.Property(x => x.FileName).HasMaxLength(240);
        artifact.Property(x => x.MediaType).HasMaxLength(120);
        artifact.Property(x => x.Sha256).HasMaxLength(64);
        artifact.Property(x => x.StorageKey).HasMaxLength(500);
        artifact.HasOne(x => x.Resume).WithMany(x => x.Artifacts).HasForeignKey(x => x.ResumeId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureJobApplication(ModelBuilder builder)
    {
        var entity = builder.Entity<JobApplicationRecord>();
        entity.ToTable("job_applications");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OwnerId, x.Status, x.UpdatedAt });
        entity.Property(x => x.Company).HasMaxLength(200);
        entity.Property(x => x.JobTitle).HasMaxLength(200);
        entity.Property(x => x.TargetUrl).HasMaxLength(2_048);
        entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        entity.Property(x => x.DetailsJson).HasColumnType("jsonb");
        entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
    }

    private static void ConfigureApplicationRun(ModelBuilder builder)
    {
        var entity = builder.Entity<ApplicationRunRecord>();
        entity.ToTable("application_runs");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OwnerId, x.Status, x.UpdatedAt });
        entity.Property(x => x.TargetUrl).HasMaxLength(2_048);
        entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
        entity.Property(x => x.ControlOwner).HasConversion<string>().HasMaxLength(16);
        entity.Property(x => x.LastCheckpointSequence).HasDefaultValue(-1L);
        entity.Property(x => x.Stage).HasMaxLength(160);
        entity.Property(x => x.CurrentUrl).HasMaxLength(2_048);
        entity.Property(x => x.BrowserSessionReference).HasMaxLength(240);
        entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();

        var checkpoint = builder.Entity<RunCheckpointRecord>();
        checkpoint.ToTable("run_checkpoints");
        checkpoint.HasKey(x => x.Id);
        checkpoint.HasIndex(x => new { x.OwnerId, x.RunId, x.Sequence }).IsUnique();
        checkpoint.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
        checkpoint.Property(x => x.Stage).HasMaxLength(160);
        checkpoint.Property(x => x.CurrentUrl).HasMaxLength(2_048);
        checkpoint.Property(x => x.CurrentDomain).HasMaxLength(253);
        checkpoint.Property(x => x.SummaryJson).HasColumnType("jsonb");
        checkpoint.HasOne(x => x.Run).WithMany(x => x.Checkpoints).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureSupportingRecords(ModelBuilder builder)
    {
        var action = builder.Entity<AgentActionRecord>();
        action.ToTable("agent_actions");
        action.HasKey(x => x.Id);
        action.HasIndex(x => new { x.OwnerId, x.RunId, x.Sequence }).IsUnique();
        action.Property(x => x.ActionType).HasMaxLength(80);
        action.Property(x => x.Summary).HasMaxLength(2_000);
        action.Property(x => x.TaskDefinitionVersion).HasMaxLength(80);
        action.Property(x => x.OutputSchemaVersion).HasMaxLength(80);
        action.Property(x => x.ModelId).HasMaxLength(160);
        action.Property(x => x.ModelRevision).HasMaxLength(160);
        action.Property(x => x.Provider).HasMaxLength(80);

        var question = builder.Entity<PendingQuestionRecord>();
        question.ToTable("pending_questions");
        question.HasKey(x => x.Id);
        question.HasIndex(x => new { x.OwnerId, x.RunId, x.AnsweredAt });
        question.Property(x => x.Prompt).HasMaxLength(4_000);
        question.Property(x => x.Kind).HasMaxLength(80);

        var decision = builder.Entity<UserDecisionRecord>();
        decision.ToTable("user_decisions");
        decision.HasKey(x => x.Id);
        decision.HasIndex(x => new { x.OwnerId, x.RunId, x.CreatedAt });
        decision.Property(x => x.DecisionType).HasMaxLength(80);
        decision.Property(x => x.DecisionJson).HasColumnType("jsonb");

        var browserSession = builder.Entity<BrowserSessionRecord>();
        browserSession.ToTable("browser_sessions");
        browserSession.HasKey(x => x.Id);
        browserSession.HasIndex(x => new { x.OwnerId, x.RunId }).IsUnique();
        browserSession.Property(x => x.RuntimeReference).HasMaxLength(240);
        browserSession.Property(x => x.ProtectedRecoveryState).HasMaxLength(1_048_576);

        var artifact = builder.Entity<ArtifactRecord>();
        artifact.ToTable("artifacts");
        artifact.HasKey(x => x.Id);
        artifact.HasIndex(x => new { x.OwnerId, x.RunId, x.Kind });
        artifact.HasIndex(x => x.ExpiresAt);
        artifact.Property(x => x.Kind).HasMaxLength(80);
        artifact.Property(x => x.FileName).HasMaxLength(240);
        artifact.Property(x => x.MediaType).HasMaxLength(120);
        artifact.Property(x => x.Sha256).HasMaxLength(64);
        artifact.Property(x => x.StorageKey).HasMaxLength(500);

        var evaluation = builder.Entity<ModelEvaluationRecord>();
        evaluation.ToTable("model_evaluations");
        evaluation.HasKey(x => x.Id);
        evaluation.HasIndex(x => new { x.ModelId, x.Revision, x.TaskDefinitionVersion });
        evaluation.Property(x => x.ModelId).HasMaxLength(160);
        evaluation.Property(x => x.Revision).HasMaxLength(160);
        evaluation.Property(x => x.Provider).HasMaxLength(80);
        evaluation.Property(x => x.TaskDefinitionVersion).HasMaxLength(80);
        evaluation.Property(x => x.OutputSchemaVersion).HasMaxLength(80);
        evaluation.Property(x => x.MetricsJson).HasColumnType("jsonb");
    }

    private static void ConfigureSensitiveApprovals(ModelBuilder builder)
    {
        var entity = builder.Entity<SensitiveAnswerApprovalRecord>();
        entity.ToTable("sensitive_answer_approvals");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OwnerId, x.RunId, x.State, x.ExpiresAt });
        entity.HasIndex(x => new { x.OwnerId, x.RunId, x.ControlId, x.SourcePath, x.CreatedAt });
        entity.Property(x => x.ControlId).HasMaxLength(160);
        entity.Property(x => x.SourcePath).HasMaxLength(500);
        entity.Property(x => x.DisplayName).HasMaxLength(200);
        entity.Property(x => x.MaskedValue).HasMaxLength(64);
        entity.Property(x => x.State).HasConversion<string>().HasMaxLength(24);
        entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
        entity.HasOne<ApplicationRunRecord>().WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne<ProfileRecord>().WithMany().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureApiIdempotency(ModelBuilder builder)
    {
        var entity = builder.Entity<ApiIdempotencyRecord>();
        entity.ToTable("api_idempotency");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OwnerId, x.Key }).IsUnique();
        entity.HasIndex(x => x.ExpiresAt);
        entity.Property(x => x.Key).HasMaxLength(128);
        entity.Property(x => x.Method).HasMaxLength(12);
        entity.Property(x => x.Path).HasMaxLength(2_048);
        entity.Property(x => x.RequestHash).HasMaxLength(64);
        entity.Property(x => x.State).HasConversion<string>().HasMaxLength(16);
        entity.Property(x => x.ContentType).HasMaxLength(200);
        entity.Property(x => x.ProtectedResponseBody).HasMaxLength(2_000_000);
        entity.Property(x => x.ETag).HasMaxLength(160);
        entity.Property(x => x.Location).HasMaxLength(2_048);
    }

    private static void ConfigureUserSettings(ModelBuilder builder)
    {
        var entity = builder.Entity<UserSettingRecord>();
        entity.ToTable("user_settings");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OwnerId, x.Key }).IsUnique();
        entity.Property(x => x.Key).HasMaxLength(80);
        entity.Property(x => x.ContentJson).HasColumnType("jsonb");
        entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
    }
}
