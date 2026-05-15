using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaIdToCandidatoDocumento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para tenants multi-banco (coluna pode já existir).
            migrationBuilder.Sql("""
                ALTER TABLE "CandidatoDocumentos" ADD COLUMN IF NOT EXISTS "VagaId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_CandidatoDocumentos_VagaId" ON "CandidatoDocumentos" ("VagaId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_CandidatoDocumentos_TenantId_VagaId_CandidatoId" ON "CandidatoDocumentos" ("TenantId", "VagaId", "CandidatoId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_CandidatoDocumentos_Vagas_VagaId'
                  ) THEN
                    ALTER TABLE "CandidatoDocumentos"
                      ADD CONSTRAINT "FK_CandidatoDocumentos_Vagas_VagaId"
                      FOREIGN KEY ("VagaId") REFERENCES "Vagas" ("Id") ON DELETE SET NULL;
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "CandidatoDocumentos" DROP CONSTRAINT IF EXISTS "FK_CandidatoDocumentos_Vagas_VagaId";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_CandidatoDocumentos_TenantId_VagaId_CandidatoId";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_CandidatoDocumentos_VagaId";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "CandidatoDocumentos" DROP COLUMN IF EXISTS "VagaId";
                """);
        }
    }
}
