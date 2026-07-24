using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyProfilesAndCredentials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_companies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "company_credentials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Username = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    LoginUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    ProtectedPassword = table.Column<string>(type: "character varying(16384)", maxLength: 16384, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_credentials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_company_credentials_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_companies_OwnerId_NormalizedName",
                table: "companies",
                columns: new[] { "OwnerId", "NormalizedName" },
                unique: true);

            migrationBuilder.Sql(
                """
                INSERT INTO companies ("Id", "OwnerId", "Name", "NormalizedName", "CreatedAt", "UpdatedAt")
                SELECT gen_random_uuid(), "OwnerId", MIN(BTRIM("Company")),
                       UPPER(REGEXP_REPLACE(BTRIM("Company"), '\s+', ' ', 'g')),
                       MIN("CreatedAt"), MAX("UpdatedAt")
                FROM job_applications
                WHERE BTRIM("Company") <> ''
                GROUP BY "OwnerId", UPPER(REGEXP_REPLACE(BTRIM("Company"), '\s+', ' ', 'g'))
                ON CONFLICT ("OwnerId", "NormalizedName") DO NOTHING;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_company_credentials_CompanyId",
                table: "company_credentials",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_company_credentials_OwnerId_CompanyId_Label",
                table: "company_credentials",
                columns: new[] { "OwnerId", "CompanyId", "Label" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "company_credentials");

            migrationBuilder.DropTable(
                name: "companies");
        }
    }
}
