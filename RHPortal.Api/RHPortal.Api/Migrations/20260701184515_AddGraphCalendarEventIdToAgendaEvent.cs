using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <inheritdoc />
public partial class AddGraphCalendarEventIdToAgendaEvent : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "GraphCalendarEventId" character varying(512) NULL;
            ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "GraphCalendarUserUpn" character varying(256) NULL;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "GraphCalendarUserUpn";
            ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "GraphCalendarEventId";
            """);
    }
}
