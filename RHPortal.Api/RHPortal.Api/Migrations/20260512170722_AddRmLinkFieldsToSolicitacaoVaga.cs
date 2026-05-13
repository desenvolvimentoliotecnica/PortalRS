using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmLinkFieldsToSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "RmCodColRequisicao" smallint NULL;

                ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "RmCriacaoSolicitadaEmUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "RmIdReq" integer NULL;

                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_TenantId_TipoSolicitacao_RmCriacaoSolicitadaEmUtc"
                ON "SolicitacoesVaga" ("TenantId", "TipoSolicitacao", "RmCriacaoSolicitadaEmUtc");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_TenantId_TipoSolicitacao_RmCriacaoSolicitadaEmUtc";

                ALTER TABLE "SolicitacoesVaga"
                DROP COLUMN IF EXISTS "RmCodColRequisicao";

                ALTER TABLE "SolicitacoesVaga"
                DROP COLUMN IF EXISTS "RmCriacaoSolicitadaEmUtc";

                ALTER TABLE "SolicitacoesVaga"
                DROP COLUMN IF EXISTS "RmIdReq";
                """);
        }
    }
}
