using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResumeBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLastCheckpointSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "LastCheckpointSequence",
                table: "application_runs",
                type: "bigint",
                nullable: false,
                defaultValue: -1L);

            migrationBuilder.Sql(
                """
                UPDATE application_runs AS runs
                SET "LastCheckpointSequence" = COALESCE((
                    SELECT MAX(checkpoints."Sequence")
                    FROM run_checkpoints AS checkpoints
                    WHERE checkpoints."RunId" = runs."Id"
                ), -1);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastCheckpointSequence",
                table: "application_runs");
        }
    }
}
