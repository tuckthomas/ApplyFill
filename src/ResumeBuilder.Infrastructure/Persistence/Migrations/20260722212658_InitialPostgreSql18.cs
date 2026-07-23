using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSql18 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "agent_actions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    TaskDefinitionVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    OutputSchemaVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ModelId = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ModelRevision = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Provider = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agent_actions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "application_runs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResumeId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Stage = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    ControlOwner = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    BrowserSessionReference = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_runs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "artifacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: true),
                    Kind = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    FileName = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    MediaType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_artifacts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "browser_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    RuntimeReference = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    ProtectedRecoveryState = table.Column<string>(type: "character varying(1048576)", maxLength: 1048576, nullable: true),
                    RecoveryStateExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_browser_sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "job_applications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Company = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    JobTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TargetUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DetailsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_job_applications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "model_evaluations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ModelId = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Revision = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Provider = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TaskDefinitionVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    OutputSchemaVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    MetricsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_model_evaluations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pending_questions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Kind = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pending_questions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    SchemaVersion = table.Column<int>(type: "integer", nullable: false),
                    ContentJson = table.Column<string>(type: "jsonb", nullable: false),
                    ProtectedApplicationData = table.Column<string>(type: "character varying(1048576)", maxLength: 1048576, nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "resumes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    SchemaVersion = table.Column<int>(type: "integer", nullable: false),
                    ContentJson = table.Column<string>(type: "jsonb", nullable: false),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_resumes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "user_decisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: true),
                    DecisionType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DecisionJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_decisions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "run_checkpoints",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Stage = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    CurrentUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CurrentDomain = table.Column<string>(type: "character varying(253)", maxLength: 253, nullable: true),
                    SummaryJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_run_checkpoints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_run_checkpoints_application_runs_RunId",
                        column: x => x.RunId,
                        principalTable: "application_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "resume_artifacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResumeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    MediaType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_resume_artifacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_resume_artifacts_resumes_ResumeId",
                        column: x => x.ResumeId,
                        principalTable: "resumes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_agent_actions_OwnerId_RunId_Sequence",
                table: "agent_actions",
                columns: new[] { "OwnerId", "RunId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_application_runs_OwnerId_Status_UpdatedAt",
                table: "application_runs",
                columns: new[] { "OwnerId", "Status", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_artifacts_ExpiresAt",
                table: "artifacts",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_artifacts_OwnerId_RunId_Kind",
                table: "artifacts",
                columns: new[] { "OwnerId", "RunId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_browser_sessions_OwnerId_RunId",
                table: "browser_sessions",
                columns: new[] { "OwnerId", "RunId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_job_applications_OwnerId_Status_UpdatedAt",
                table: "job_applications",
                columns: new[] { "OwnerId", "Status", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_model_evaluations_ModelId_Revision_TaskDefinitionVersion",
                table: "model_evaluations",
                columns: new[] { "ModelId", "Revision", "TaskDefinitionVersion" });

            migrationBuilder.CreateIndex(
                name: "IX_pending_questions_OwnerId_RunId_AnsweredAt",
                table: "pending_questions",
                columns: new[] { "OwnerId", "RunId", "AnsweredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_profiles_OwnerId",
                table: "profiles",
                column: "OwnerId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_resume_artifacts_OwnerId_ResumeId",
                table: "resume_artifacts",
                columns: new[] { "OwnerId", "ResumeId" });

            migrationBuilder.CreateIndex(
                name: "IX_resume_artifacts_ResumeId",
                table: "resume_artifacts",
                column: "ResumeId");

            migrationBuilder.CreateIndex(
                name: "IX_resumes_OwnerId_UpdatedAt",
                table: "resumes",
                columns: new[] { "OwnerId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_run_checkpoints_OwnerId_RunId_Sequence",
                table: "run_checkpoints",
                columns: new[] { "OwnerId", "RunId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_run_checkpoints_RunId",
                table: "run_checkpoints",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_user_decisions_OwnerId_RunId_CreatedAt",
                table: "user_decisions",
                columns: new[] { "OwnerId", "RunId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agent_actions");

            migrationBuilder.DropTable(
                name: "artifacts");

            migrationBuilder.DropTable(
                name: "browser_sessions");

            migrationBuilder.DropTable(
                name: "job_applications");

            migrationBuilder.DropTable(
                name: "model_evaluations");

            migrationBuilder.DropTable(
                name: "pending_questions");

            migrationBuilder.DropTable(
                name: "profiles");

            migrationBuilder.DropTable(
                name: "resume_artifacts");

            migrationBuilder.DropTable(
                name: "run_checkpoints");

            migrationBuilder.DropTable(
                name: "user_decisions");

            migrationBuilder.DropTable(
                name: "resumes");

            migrationBuilder.DropTable(
                name: "application_runs");
        }
    }
}
