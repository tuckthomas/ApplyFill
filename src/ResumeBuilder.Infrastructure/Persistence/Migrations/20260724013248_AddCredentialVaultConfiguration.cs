using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCredentialVaultConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "credential_vaults",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Salt = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    VerificationCiphertext = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credential_vaults", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_credential_vaults_OwnerId",
                table: "credential_vaults",
                column: "OwnerId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "credential_vaults");
        }
    }
}
