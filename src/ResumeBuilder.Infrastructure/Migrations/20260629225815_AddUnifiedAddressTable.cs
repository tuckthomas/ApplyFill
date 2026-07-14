using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUnifiedAddressTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "City",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "State",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "City",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "Country",
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

            migrationBuilder.DropColumn(
                name: "StreetAddressLine2",
                table: "ResumeExperiences");

            migrationBuilder.AddColumn<Guid>(
                name: "AddressId",
                table: "UserProfiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AddressId",
                table: "ResumeExperiences",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Addresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StreetAddressLine1 = table.Column<string>(type: "text", nullable: true),
                    StreetAddressLine2 = table.Column<string>(type: "text", nullable: true),
                    City = table.Column<string>(type: "text", nullable: true),
                    State = table.Column<string>(type: "text", nullable: true),
                    PostalCode = table.Column<string>(type: "text", nullable: true),
                    Country = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Addresses", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_AddressId",
                table: "UserProfiles",
                column: "AddressId");

            migrationBuilder.CreateIndex(
                name: "IX_ResumeExperiences_AddressId",
                table: "ResumeExperiences",
                column: "AddressId");

            migrationBuilder.AddForeignKey(
                name: "FK_ResumeExperiences_Addresses_AddressId",
                table: "ResumeExperiences",
                column: "AddressId",
                principalTable: "Addresses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_UserProfiles_Addresses_AddressId",
                table: "UserProfiles",
                column: "AddressId",
                principalTable: "Addresses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ResumeExperiences_Addresses_AddressId",
                table: "ResumeExperiences");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProfiles_Addresses_AddressId",
                table: "UserProfiles");

            migrationBuilder.DropTable(
                name: "Addresses");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_AddressId",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_ResumeExperiences_AddressId",
                table: "ResumeExperiences");

            migrationBuilder.DropColumn(
                name: "AddressId",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "AddressId",
                table: "ResumeExperiences");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "UserProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "UserProfiles",
                type: "text",
                nullable: true);

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

            migrationBuilder.AddColumn<string>(
                name: "StreetAddressLine2",
                table: "ResumeExperiences",
                type: "text",
                nullable: true);
        }
    }
}
