using Microsoft.EntityFrameworkCore;
using ResumeBuilder.Domain.Entities;
using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<UserProfile> UserProfiles { get; set; }
    public DbSet<Resume> Resumes { get; set; }
    public DbSet<Address> Addresses { get; set; }
    public DbSet<WebLink> WebLinks { get; set; }
    public DbSet<ProfileConsent> ProfileConsents { get; set; }
    public DbSet<ResumeExperience> ResumeExperiences { get; set; }
    public DbSet<ResumeBullet> ResumeBullets { get; set; }
    public DbSet<ResumeEducation> ResumeEducations { get; set; }
    public DbSet<ResumeProject> ResumeProjects { get; set; }
    public DbSet<ResumeSkill> ResumeSkills { get; set; }
    public DbSet<ResumeTemplate> ResumeTemplates { get; set; }
    public DbSet<ResumeLayoutAnalysis> ResumeLayoutAnalyses { get; set; }
    public DbSet<ResumeDocument> ResumeDocuments { get; set; }
    public DbSet<JobTarget> JobTargets { get; set; }
    public DbSet<ApplicationPacket> ApplicationPackets { get; set; }
    public DbSet<ApplicationLog> ApplicationLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.WorkAuthorizationStatus).HasConversion<string>();
            entity.HasOne(e => e.User)
                .WithOne(e => e.Profile)
                .HasForeignKey<UserProfile>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Address)
                .WithMany()
                .HasForeignKey(e => e.AddressId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WebLink>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.UserProfile)
                .WithMany(e => e.WebLinks)
                .HasForeignKey(e => e.UserProfileId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProfileConsent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ConsentType).HasMaxLength(100);
            entity.Property(e => e.DisclosureVersion).HasMaxLength(100);
            entity.Property(e => e.DisclosureSha256).HasMaxLength(64);
            entity.Property(e => e.CaptureMethod).HasMaxLength(100);
            entity.Property(e => e.IpAddress).HasMaxLength(64);
            entity.Property(e => e.UserAgent).HasMaxLength(2048);
            entity.HasIndex(e => new { e.UserProfileId, e.ConsentType, e.DisclosureVersion }).IsUnique();
            entity.HasOne(e => e.UserProfile)
                .WithMany(e => e.Consents)
                .HasForeignKey(e => e.UserProfileId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Resume>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                .WithMany(e => e.Resumes)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeExperience>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StartDatePrecision).HasConversion<string>();
            entity.Property(e => e.EndDatePrecision).HasConversion<string>();
            entity.HasOne(e => e.Resume)
                .WithMany(e => e.Experiences)
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Address)
                .WithMany()
                .HasForeignKey(e => e.AddressId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ResumeBullet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Experience)
                .WithMany(e => e.Bullets)
                .HasForeignKey(e => e.ExperienceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeEducation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StartDatePrecision).HasConversion<string>();
            entity.Property(e => e.EndDatePrecision).HasConversion<string>();
            entity.HasOne(e => e.Resume)
                .WithMany(e => e.Educations)
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeProject>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StartDatePrecision).HasConversion<string>();
            entity.Property(e => e.EndDatePrecision).HasConversion<string>();
            entity.HasOne(e => e.Resume)
                .WithMany(e => e.Projects)
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeSkill>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Resume)
                .WithMany(e => e.Skills)
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeTemplate>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<ResumeLayoutAnalysis>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.WarningsJson).HasColumnType("jsonb");
            entity.Property(e => e.RecommendedAdjustmentsJson).HasColumnType("jsonb");
            entity.HasOne(e => e.Resume)
                .WithMany(e => e.LayoutAnalyses)
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeDocument>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasOne(e => e.Resume)
                .WithMany(e => e.Documents)
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JobTarget>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                .WithMany(e => e.JobTargets)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicationPacket>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.PacketJson).HasColumnType("jsonb");
            entity.HasOne(e => e.User)
                .WithMany(e => e.ApplicationPackets)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Resume)
                .WithMany()
                .HasForeignKey(e => e.ResumeId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.JobTarget)
                .WithMany(e => e.ApplicationPackets)
                .HasForeignKey(e => e.JobTargetId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(e => e.Documents)
                .WithMany(e => e.ApplicationPackets)
                .UsingEntity("ApplicationPacketDocument");
        });

        modelBuilder.Entity<ApplicationLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasOne(e => e.User)
                .WithMany(e => e.ApplicationLogs)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ApplicationPacket)
                .WithMany(e => e.Logs)
                .HasForeignKey(e => e.ApplicationPacketId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.JobTarget)
                .WithMany(e => e.ApplicationLogs)
                .HasForeignKey(e => e.JobTargetId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
