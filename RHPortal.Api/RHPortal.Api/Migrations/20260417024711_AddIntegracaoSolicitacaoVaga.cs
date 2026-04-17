using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIntegracaoSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "IntegracaoMensagem" character varying(2000) NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "IntegracaoResultado" smallint NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "IntegradaEmUtc" timestamp with time zone NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "TentativasIntegracao",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "UltimaTentativaUtc",
                table: "SolicitacoesVaga");
        }
    }
}
