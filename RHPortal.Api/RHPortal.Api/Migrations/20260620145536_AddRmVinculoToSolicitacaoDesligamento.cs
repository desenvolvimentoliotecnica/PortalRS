using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <summary>Vínculo RM (TIPO|COL|IDREQ) em solicitações de desligamento importadas do RM.</summary>
public partial class AddRmVinculoToSolicitacaoDesligamento : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "RmCodColRequisicao" smallint NULL;
            ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "RmCodStatus" smallint NULL;
            ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "RmIdReq" integer NULL;
            ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "RmRequisicaoCodigo" character varying(120) NULL;
            ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "RmUltimaSincronizacaoUtc" timestamp with time zone NULL;
            ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "RmUltimaStatusDescricaoRm" character varying(240) NULL;
            """);

        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_SolicitacoesDesligamento_TenantId_RmRequisicaoCodigo"
            ON "SolicitacoesDesligamento" ("TenantId", "RmRequisicaoCodigo")
            WHERE "RmRequisicaoCodigo" IS NOT NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_SolicitacoesDesligamento_TenantId_RmRequisicaoCodigo";
            ALTER TABLE "SolicitacoesDesligamento" DROP COLUMN IF EXISTS "RmUltimaStatusDescricaoRm";
            ALTER TABLE "SolicitacoesDesligamento" DROP COLUMN IF EXISTS "RmUltimaSincronizacaoUtc";
            ALTER TABLE "SolicitacoesDesligamento" DROP COLUMN IF EXISTS "RmRequisicaoCodigo";
            ALTER TABLE "SolicitacoesDesligamento" DROP COLUMN IF EXISTS "RmIdReq";
            ALTER TABLE "SolicitacoesDesligamento" DROP COLUMN IF EXISTS "RmCodStatus";
            ALTER TABLE "SolicitacoesDesligamento" DROP COLUMN IF EXISTS "RmCodColRequisicao";
            """);
    }
}
