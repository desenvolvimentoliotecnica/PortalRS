using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInterviewCandidateConfirmationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidateConfirmationToken" character varying(80) NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidateRespondedAtUtc" timestamp with time zone NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidateResponseMessage" character varying(1000) NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidateResponseStatus" character varying(40) NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidateSuggestedEndAtUtc" timestamp with time zone NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidateSuggestedStartAtUtc" timestamp with time zone NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidatoId" uuid NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "CandidaturaId" uuid NULL;
                ALTER TABLE "AgendaEvents" ADD COLUMN IF NOT EXISTS "VagaId" uuid NULL;
                CREATE INDEX IF NOT EXISTS "IX_AgendaEvents_TenantId_CandidateConfirmationToken"
                    ON "AgendaEvents" ("TenantId", "CandidateConfirmationToken");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_AgendaEvents_TenantId_CandidateConfirmationToken";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidateConfirmationToken";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidateRespondedAtUtc";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidateResponseMessage";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidateResponseStatus";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidateSuggestedEndAtUtc";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidateSuggestedStartAtUtc";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidatoId";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "CandidaturaId";
                ALTER TABLE "AgendaEvents" DROP COLUMN IF EXISTS "VagaId";
                """);
        }
    }
}
