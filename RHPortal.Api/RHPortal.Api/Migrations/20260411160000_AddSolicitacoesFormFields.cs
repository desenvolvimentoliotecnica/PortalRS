using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411160000_AddSolicitacoesFormFields")]
public partial class AddSolicitacoesFormFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── SolicitacoesVaga: campos A.RH.013 ──
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "TipoContrato" smallint NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "PrazoDias" integer NULL,
                ADD COLUMN IF NOT EXISTS "MotivoRequisicao" smallint NULL,
                ADD COLUMN IF NOT EXISTS "CnhObrigatoria" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "DisponibilidadeViagens" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "EscalaTrabalho" character varying(200) NULL;
            """);

        // ── SolicitacoesPromocao: campos A.RH.005 ──
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesPromocao"
                ADD COLUMN IF NOT EXISTS "NovaUnidadeId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "MotivoMovimentacao" smallint NULL;
            """);

        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesPromocao_Units_NovaUnidadeId'
                ) THEN
                    ALTER TABLE "SolicitacoesPromocao"
                        ADD CONSTRAINT "FK_SolicitacoesPromocao_Units_NovaUnidadeId"
                        FOREIGN KEY ("NovaUnidadeId") REFERENCES "Units"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """);

        // ── SolicitacoesDesligamento: campo A.RH.015 ──
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesDesligamento"
                ADD COLUMN IF NOT EXISTS "PossuiEstabilidade" boolean NOT NULL DEFAULT false;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga"
                DROP COLUMN IF EXISTS "TipoContrato",
                DROP COLUMN IF EXISTS "PrazoDias",
                DROP COLUMN IF EXISTS "MotivoRequisicao",
                DROP COLUMN IF EXISTS "CnhObrigatoria",
                DROP COLUMN IF EXISTS "DisponibilidadeViagens",
                DROP COLUMN IF EXISTS "EscalaTrabalho";
            """);

        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesPromocao"
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_Units_NovaUnidadeId",
                DROP COLUMN IF EXISTS "NovaUnidadeId",
                DROP COLUMN IF EXISTS "MotivoMovimentacao";
            """);

        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesDesligamento"
                DROP COLUMN IF EXISTS "PossuiEstabilidade";
            """);
    }
}
