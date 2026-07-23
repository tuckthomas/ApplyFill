using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationRunRecoveryState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CurrentUrl",
                table: "application_runs",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE application_runs AS run
                SET "CurrentUrl" = latest."CurrentUrl"
                FROM (
                    SELECT DISTINCT ON ("RunId")
                        "RunId",
                        regexp_replace("CurrentUrl", '[?#].*$', '') AS "CurrentUrl"
                    FROM run_checkpoints
                    WHERE "CurrentUrl" IS NOT NULL
                    ORDER BY "RunId", "Sequence" DESC
                ) AS latest
                WHERE run."Id" = latest."RunId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CurrentUrl",
                table: "application_runs");
        }
    }
}
