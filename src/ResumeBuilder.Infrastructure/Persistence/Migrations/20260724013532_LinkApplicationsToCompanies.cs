using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkApplicationsToCompanies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "job_applications",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE job_applications AS application
                SET "CompanyId" = company."Id"
                FROM companies AS company
                WHERE company."OwnerId" = application."OwnerId"
                  AND company."NormalizedName" =
                      UPPER(REGEXP_REPLACE(BTRIM(application."Company"), '\s+', ' ', 'g'));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_job_applications_CompanyId",
                table: "job_applications",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_job_applications_OwnerId_CompanyId",
                table: "job_applications",
                columns: new[] { "OwnerId", "CompanyId" });

            migrationBuilder.AddForeignKey(
                name: "FK_job_applications_companies_CompanyId",
                table: "job_applications",
                column: "CompanyId",
                principalTable: "companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_job_applications_companies_CompanyId",
                table: "job_applications");

            migrationBuilder.DropIndex(
                name: "IX_job_applications_CompanyId",
                table: "job_applications");

            migrationBuilder.DropIndex(
                name: "IX_job_applications_OwnerId_CompanyId",
                table: "job_applications");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "job_applications");
        }
    }
}
