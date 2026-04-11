using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411170000_AddSolicitacaoVagaEmpresaCCLotacao")]
public partial class AddSolicitacaoVagaEmpresaCCLotacao : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "CentroCustoId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "UnidadeLotacaoId" uuid NULL;
            """);

        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesVaga_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "SolicitacoesVaga"
                        ADD CONSTRAINT "FK_SolicitacoesVaga_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId") REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesVaga_CentrosCusto_CentroCustoId'
                ) THEN
                    ALTER TABLE "SolicitacoesVaga"
                        ADD CONSTRAINT "FK_SolicitacoesVaga_CentrosCusto_CentroCustoId"
                        FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto"("Id") ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesVaga_UnidadesLotacao_UnidadeLotacaoId'
                ) THEN
                    ALTER TABLE "SolicitacoesVaga"
                        ADD CONSTRAINT "FK_SolicitacoesVaga_UnidadesLotacao_UnidadeLotacaoId"
                        FOREIGN KEY ("UnidadeLotacaoId") REFERENCES "UnidadesLotacao"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga"
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Empresas_EmpresaId",
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_CentrosCusto_CentroCustoId",
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_UnidadesLotacao_UnidadeLotacaoId",
                DROP COLUMN IF EXISTS "EmpresaId",
                DROP COLUMN IF EXISTS "CentroCustoId",
                DROP COLUMN IF EXISTS "UnidadeLotacaoId";
            """);
    }
}
