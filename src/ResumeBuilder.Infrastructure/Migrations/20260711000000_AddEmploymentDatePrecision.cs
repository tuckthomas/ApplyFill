using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
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
