using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411180000_AddSolicitacaoPromocaoEmpresaCCLotacao")]
public partial class AddSolicitacaoPromocaoEmpresaCCLotacao : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesPromocao"
                ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "CentroCustoId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "UnidadeLotacaoId" uuid NULL;
            """);

        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesPromocao_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "SolicitacoesPromocao"
                        ADD CONSTRAINT "FK_SolicitacoesPromocao_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId") REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesPromocao_CentrosCusto_CentroCustoId'
                ) THEN
                    ALTER TABLE "SolicitacoesPromocao"
                        ADD CONSTRAINT "FK_SolicitacoesPromocao_CentrosCusto_CentroCustoId"
                        FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto"("Id") ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesPromocao_UnidadesLotacao_UnidadeLotacaoId'
                ) THEN
                    ALTER TABLE "SolicitacoesPromocao"
                        ADD CONSTRAINT "FK_SolicitacoesPromocao_UnidadesLotacao_UnidadeLotacaoId"
                        FOREIGN KEY ("UnidadeLotacaoId") REFERENCES "UnidadesLotacao"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesPromocao"
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_Empresas_EmpresaId",
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_CentrosCusto_CentroCustoId",
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_UnidadesLotacao_UnidadeLotacaoId",
                DROP COLUMN IF EXISTS "EmpresaId",
                DROP COLUMN IF EXISTS "CentroCustoId",
                DROP COLUMN IF EXISTS "UnidadeLotacaoId";
            """);
    }
}
