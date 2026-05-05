using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTurnoIdToSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para tenants com schema já alinhado manualmente.
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "TurnoId" uuid NULL;
                """);
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesVaga_Turnos_TurnoId'
                    ) THEN
                        ALTER TABLE "SolicitacoesVaga"
                        ADD CONSTRAINT "FK_SolicitacoesVaga_Turnos_TurnoId"
                        FOREIGN KEY ("TurnoId") REFERENCES "Turnos" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_TurnoId" ON "SolicitacoesVaga" ("TurnoId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Turnos_TurnoId";
                """);
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_TurnoId";
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" DROP COLUMN IF EXISTS "TurnoId";
                """);
        }
    }
}
