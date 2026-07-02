using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <inheritdoc />
public partial class AddOnlineMeetingJoinUrlToAgendaEvent : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "OnlineMeetingJoinUrl" text NULL;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "OnlineMeetingJoinUrl";
            """);
    }
}
