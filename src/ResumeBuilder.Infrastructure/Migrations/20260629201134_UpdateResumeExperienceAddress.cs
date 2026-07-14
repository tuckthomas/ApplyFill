using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateResumeExperienceAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Location",
                table: "ResumeExperiences",
                newName: "StreetAddressLine2");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PostalCode",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StreetAddressLine1",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "City",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "PostalCode",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "State",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "StreetAddressLine1",
                table: "ResumeExperiences");

            migrationBuilder.RenameColumn(
                name: "StreetAddressLine2",
                table: "ResumeExperiences",
                newName: "Location");
        }
    }
}
