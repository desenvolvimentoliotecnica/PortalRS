using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidaturaIdToPropostaVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PropostasVaga" ADD COLUMN IF NOT EXISTS "CandidaturaId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_PropostasVaga_CandidaturaId"
                    ON "PropostasVaga" ("CandidaturaId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_PropostasVaga_TenantId_CandidaturaId"
                    ON "PropostasVaga" ("TenantId", "CandidaturaId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropostasVaga_Candidaturas_CandidaturaId'
                    ) THEN
                        ALTER TABLE "PropostasVaga"
                            ADD CONSTRAINT "FK_PropostasVaga_Candidaturas_CandidaturaId"
                            FOREIGN KEY ("CandidaturaId") REFERENCES "Candidaturas" ("Id") ON DELETE SET NULL;
                    END IF;
                END
                $$;
                """);

            // Backfill: para propostas antigas, tenta achar a Candidatura (CandidatoId + VagaId) correspondente.
            migrationBuilder.Sql("""
                UPDATE "PropostasVaga" p
                SET "CandidaturaId" = c."Id"
                FROM "Candidaturas" c
                WHERE p."CandidaturaId" IS NULL
                  AND c."TenantId" = p."TenantId"
                  AND c."CandidatoId" = p."CandidatoId"
                  AND c."VagaId" = p."VagaId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PropostasVaga" DROP CONSTRAINT IF EXISTS "FK_PropostasVaga_Candidaturas_CandidaturaId";
                DROP INDEX IF EXISTS "IX_PropostasVaga_TenantId_CandidaturaId";
                DROP INDEX IF EXISTS "IX_PropostasVaga_CandidaturaId";
                ALTER TABLE "PropostasVaga" DROP COLUMN IF EXISTS "CandidaturaId";
                """);
        }
    }
}
