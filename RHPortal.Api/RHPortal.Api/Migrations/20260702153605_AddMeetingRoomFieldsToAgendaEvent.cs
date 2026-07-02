using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <inheritdoc />
public partial class AddMeetingRoomFieldsToAgendaEvent : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "MeetingFormat" character varying(20) NULL;
            ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "RoomEmail" character varying(320) NULL;
            ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "RoomDisplayName" character varying(160) NULL;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "MeetingFormat";
            ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "RoomEmail";
            ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "RoomDisplayName";
            """);
    }
}
