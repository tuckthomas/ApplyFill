using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSensitiveAnswerApprovals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sensitive_answer_approvals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    ControlId = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    SourcePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MaskedValue = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    State = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    ProfileConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DecidedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sensitive_answer_approvals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sensitive_answer_approvals_application_runs_RunId",
                        column: x => x.RunId,
                        principalTable: "application_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sensitive_answer_approvals_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sensitive_answer_approvals_OwnerId_RunId_ControlId_SourcePa~",
                table: "sensitive_answer_approvals",
                columns: new[] { "OwnerId", "RunId", "ControlId", "SourcePath", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_sensitive_answer_approvals_OwnerId_RunId_State_ExpiresAt",
                table: "sensitive_answer_approvals",
                columns: new[] { "OwnerId", "RunId", "State", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_sensitive_answer_approvals_ProfileId",
                table: "sensitive_answer_approvals",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_sensitive_answer_approvals_RunId",
                table: "sensitive_answer_approvals",
                column: "RunId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sensitive_answer_approvals");
        }
    }
}
