using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConsolidateDatabaseSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "ResumeDocxFileId",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "ResumeGoogleDocFileId",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "ResumePdfFileId",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "TargetJobUrl",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "ApplicationLogs");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                table: "ApplicationLogs");

            migrationBuilder.DropColumn(
                name: "TargetJobUrl",
                table: "ApplicationLogs");

            migrationBuilder.Sql("""
                ALTER TABLE "ResumeLayoutAnalyses"
                ALTER COLUMN "WarningsJson" TYPE jsonb
                USING CASE
                    WHEN "WarningsJson" IS NULL OR btrim("WarningsJson") = '' THEN NULL
                    ELSE "WarningsJson"::jsonb
                END;

                ALTER TABLE "ResumeLayoutAnalyses"
                ALTER COLUMN "RecommendedAdjustmentsJson" TYPE jsonb
                USING CASE
                    WHEN "RecommendedAdjustmentsJson" IS NULL OR btrim("RecommendedAdjustmentsJson") = '' THEN NULL
                    ELSE "RecommendedAdjustmentsJson"::jsonb
                END;

                ALTER TABLE "ApplicationPackets"
                ALTER COLUMN "PacketJson" DROP NOT NULL,
                ALTER COLUMN "PacketJson" TYPE jsonb
                USING CASE
                    WHEN "PacketJson" IS NULL OR btrim("PacketJson") = '' THEN NULL
                    ELSE "PacketJson"::jsonb
                END;
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "JobTargetId",
                table: "ApplicationPackets",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "JobTargetId",
                table: "ApplicationLogs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "ApplicationPacketDocument",
                columns: table => new
                {
                    ApplicationPacketsId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentsId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationPacketDocument", x => new { x.ApplicationPacketsId, x.DocumentsId });
                    table.ForeignKey(
                        name: "FK_ApplicationPacketDocument_ApplicationPackets_ApplicationPac~",
                        column: x => x.ApplicationPacketsId,
                        principalTable: "ApplicationPackets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ApplicationPacketDocument_ResumeDocuments_DocumentsId",
                        column: x => x.DocumentsId,
                        principalTable: "ResumeDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JobTargets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "text", nullable: false),
                    JobTitle = table.Column<string>(type: "text", nullable: false),
                    TargetJobUrl = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: true),
                    BaseSalary = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JobTargets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JobTargets_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationPackets_JobTargetId",
                table: "ApplicationPackets",
                column: "JobTargetId");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationLogs_JobTargetId",
                table: "ApplicationLogs",
                column: "JobTargetId");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationPacketDocument_DocumentsId",
                table: "ApplicationPacketDocument",
                column: "DocumentsId");

            migrationBuilder.CreateIndex(
                name: "IX_JobTargets_UserId",
                table: "JobTargets",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ApplicationLogs_JobTargets_JobTargetId",
                table: "ApplicationLogs",
                column: "JobTargetId",
                principalTable: "JobTargets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ApplicationPackets_JobTargets_JobTargetId",
                table: "ApplicationPackets",
                column: "JobTargetId",
                principalTable: "JobTargets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ApplicationLogs_JobTargets_JobTargetId",
                table: "ApplicationLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ApplicationPackets_JobTargets_JobTargetId",
                table: "ApplicationPackets");

            migrationBuilder.DropTable(
                name: "ApplicationPacketDocument");

            migrationBuilder.DropTable(
                name: "JobTargets");

            migrationBuilder.DropIndex(
                name: "IX_ApplicationPackets_JobTargetId",
                table: "ApplicationPackets");

            migrationBuilder.DropIndex(
                name: "IX_ApplicationLogs_JobTargetId",
                table: "ApplicationLogs");

            migrationBuilder.DropColumn(
                name: "JobTargetId",
                table: "ApplicationPackets");

            migrationBuilder.DropColumn(
                name: "JobTargetId",
                table: "ApplicationLogs");

            migrationBuilder.Sql("""
                ALTER TABLE "ResumeLayoutAnalyses"
                ALTER COLUMN "WarningsJson" TYPE text
                USING "WarningsJson"::text;

                ALTER TABLE "ResumeLayoutAnalyses"
                ALTER COLUMN "RecommendedAdjustmentsJson" TYPE text
                USING "RecommendedAdjustmentsJson"::text;

                UPDATE "ApplicationPackets"
                SET "PacketJson" = '{}'::jsonb
                WHERE "PacketJson" IS NULL;

                ALTER TABLE "ApplicationPackets"
                ALTER COLUMN "PacketJson" TYPE text
                USING "PacketJson"::text,
                ALTER COLUMN "PacketJson" SET DEFAULT '',
                ALTER COLUMN "PacketJson" SET NOT NULL;
                """);

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "ApplicationPackets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                table: "ApplicationPackets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ResumeDocxFileId",
                table: "ApplicationPackets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumeGoogleDocFileId",
                table: "ApplicationPackets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumePdfFileId",
                table: "ApplicationPackets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TargetJobUrl",
                table: "ApplicationPackets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "ApplicationLogs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                table: "ApplicationLogs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TargetJobUrl",
                table: "ApplicationLogs",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
