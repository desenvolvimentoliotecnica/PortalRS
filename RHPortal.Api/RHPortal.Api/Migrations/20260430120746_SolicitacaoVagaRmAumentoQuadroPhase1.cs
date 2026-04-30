using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <inheritdoc />
public partial class SolicitacaoVagaRmAumentoQuadroPhase1 : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "FaixaSalarialMax" numeric(18,2) NULL;
            ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "FaixaSalarialMin" numeric(18,2) NULL;
            ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "RequisitosDetalhadosJson" jsonb NULL;
            ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "RmCodStatus" smallint NULL;
            ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "RmRequisicaoCodigo" character varying(120) NULL;
            ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "RmUltimaSincronizacaoUtc" timestamp with time zone NULL;
            """);

        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "RmRequisicaoStatusMaps" (
                "Id" uuid NOT NULL,
                "TenantId" character varying(64) NOT NULL,
                "CodStatusRm" integer NOT NULL,
                "PortalStatusKey" character varying(80) NOT NULL,
                "Priority" integer NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "PK_RmRequisicaoStatusMaps" PRIMARY KEY ("Id"));
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_RmRequisicaoStatusMaps_TenantId_CodStatusRm"
                ON "RmRequisicaoStatusMaps" ("TenantId", "CodStatusRm");
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "RmRequisicaoStatusMaps");

        migrationBuilder.DropColumn(
            name: "FaixaSalarialMax",
            table: "SolicitacoesVaga");

        migrationBuilder.DropColumn(
            name: "FaixaSalarialMin",
            table: "SolicitacoesVaga");

        migrationBuilder.DropColumn(
            name: "RequisitosDetalhadosJson",
            table: "SolicitacoesVaga");

        migrationBuilder.DropColumn(
            name: "RmCodStatus",
            table: "SolicitacoesVaga");

        migrationBuilder.DropColumn(
            name: "RmRequisicaoCodigo",
            table: "SolicitacoesVaga");

        migrationBuilder.DropColumn(
            name: "RmUltimaSincronizacaoUtc",
            table: "SolicitacoesVaga");
    }
}
