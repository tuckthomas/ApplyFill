using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResumeBuilder.Infrastructure.Data;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260711001000_ExpandResumeEducation")]
    public partial class ExpandResumeEducation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdditionalDetails",
                table: "ResumeEducations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "ResumeEducations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "ResumeEducations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EndDatePrecision",
                table: "ResumeEducations",
                type: "text",
                nullable: false,
                defaultValue: "Exact");

            migrationBuilder.AddColumn<bool>(
                name: "IsCurrentlyEnrolled",
                table: "ResumeEducations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRemote",
                table: "ResumeEducations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StartDatePrecision",
                table: "ResumeEducations",
                type: "text",
                nullable: false,
                defaultValue: "Exact");

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "ResumeEducations",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdditionalDetails",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "City",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "EndDatePrecision",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "IsCurrentlyEnrolled",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "IsRemote",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "StartDatePrecision",
                table: "ResumeEducations");

            migrationBuilder.DropColumn(
                name: "State",
                table: "ResumeEducations");
        }
    }
}
