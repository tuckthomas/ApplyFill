using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileConsentAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProfileConsents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisclosureVersion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisclosureText = table.Column<string>(type: "text", nullable: false),
                    DisclosureSha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CaptureMethod = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    ConsentedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfileConsents_UserProfiles_UserProfileId",
                        column: x => x.UserProfileId,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProfileConsents_UserProfileId_ConsentType_DisclosureVersion",
                table: "ProfileConsents",
                columns: new[] { "UserProfileId", "ConsentType", "DisclosureVersion" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProfileConsents");
        }
    }
}
