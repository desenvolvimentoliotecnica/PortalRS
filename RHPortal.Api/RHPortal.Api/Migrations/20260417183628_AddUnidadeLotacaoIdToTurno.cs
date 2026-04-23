using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUnidadeLotacaoIdToTurno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Turnos" ADD COLUMN IF NOT EXISTS "UnidadeLotacaoId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Turnos_UnidadeLotacaoId"
                ON "Turnos" ("UnidadeLotacaoId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_Turnos_UnidadesLotacao_UnidadeLotacaoId'
                    ) THEN
                        ALTER TABLE "Turnos"
                        ADD CONSTRAINT "FK_Turnos_UnidadesLotacao_UnidadeLotacaoId"
                        FOREIGN KEY ("UnidadeLotacaoId")
                        REFERENCES "UnidadesLotacao" ("Id")
                        ON DELETE SET NULL;
                    END IF;
                END$$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Turnos" DROP CONSTRAINT IF EXISTS "FK_Turnos_UnidadesLotacao_UnidadeLotacaoId";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_Turnos_UnidadeLotacaoId";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Turnos" DROP COLUMN IF EXISTS "UnidadeLotacaoId";
                """);
        }
    }
}
