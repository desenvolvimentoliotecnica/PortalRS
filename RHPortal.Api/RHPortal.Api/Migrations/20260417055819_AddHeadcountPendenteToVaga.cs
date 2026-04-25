using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHeadcountPendenteToVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para multi-tenant: usar IF NOT EXISTS
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "HeadcountPendente" integer NOT NULL DEFAULT 0;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "DecisaoRH" smallint NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "DecisaoRHEmUtc" timestamptz NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "DecisaoRHPrazoMeses" integer NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "DecisaoRHRevisadoPorId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_DecisaoRHRevisadoPorId"
                    ON "SolicitacoesVaga" ("DecisaoRHRevisadoPorId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_SolicitacoesVaga_Funcionarios_DecisaoRHRevisadoPorId'
                    ) THEN
                        ALTER TABLE "SolicitacoesVaga"
                            ADD CONSTRAINT "FK_SolicitacoesVaga_Funcionarios_DecisaoRHRevisadoPorId"
                            FOREIGN KEY ("DecisaoRHRevisadoPorId") REFERENCES "Funcionarios" ("Id");
                    END IF;
                END$$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_DecisaoRHRevisadoPorId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_DecisaoRHRevisadoPorId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "HeadcountPendente",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "DecisaoRH",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "DecisaoRHEmUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "DecisaoRHPrazoMeses",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "DecisaoRHRevisadoPorId",
                table: "SolicitacoesVaga");
        }
    }
}
