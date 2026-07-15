using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResumeBuilder.Infrastructure.Data;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260711000000_AddEmploymentDatePrecision")]
    public partial class AddEmploymentDatePrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EndDatePrecision",
                table: "ResumeExperiences",
                type: "text",
                nullable: false,
                defaultValue: "Exact");

            migrationBuilder.AddColumn<string>(
                name: "StartDatePrecision",
                table: "ResumeExperiences",
                type: "text",
                nullable: false,
                defaultValue: "Exact");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndDatePrecision",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "StartDatePrecision",
                table: "ResumeExperiences");
        }
    }
}
