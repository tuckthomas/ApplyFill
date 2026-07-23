using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApiIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "api_idempotency",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Method = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    Path = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    RequestHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    State = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: true),
                    ContentType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ProtectedResponseBody = table.Column<string>(type: "character varying(2000000)", maxLength: 2000000, nullable: true),
                    ETag = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Location = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_idempotency", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_api_idempotency_ExpiresAt",
                table: "api_idempotency",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_api_idempotency_OwnerId_Key",
                table: "api_idempotency",
                columns: new[] { "OwnerId", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "api_idempotency");
        }
    }
}
