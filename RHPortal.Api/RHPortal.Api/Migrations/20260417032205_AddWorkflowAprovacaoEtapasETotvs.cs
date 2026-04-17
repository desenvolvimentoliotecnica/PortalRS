using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowAprovacaoEtapasETotvs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "WorkflowsRH" ADD COLUMN IF NOT EXISTS "DesligamentoId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "AzureAdClientId" text NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "AzureAdClientSecret" text NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "AzureAdTenantId" text NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_WorkflowsRH_DesligamentoId"
                    ON "WorkflowsRH" ("DesligamentoId");
                """);

            migrationBuilder.Sql("""
                DO $$ BEGIN
                    ALTER TABLE "WorkflowsRH"
                        ADD CONSTRAINT "FK_WorkflowsRH_SolicitacoesDesligamento_DesligamentoId"
                        FOREIGN KEY ("DesligamentoId")
                        REFERENCES "SolicitacoesDesligamento" ("Id");
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkflowsRH_SolicitacoesDesligamento_DesligamentoId",
                table: "WorkflowsRH");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowsRH_DesligamentoId",
                table: "WorkflowsRH");

            migrationBuilder.DropColumn(
                name: "DesligamentoId",
                table: "WorkflowsRH");

            migrationBuilder.DropColumn(
                name: "AzureAdClientId",
                table: "TenantConfiguracoes");

            migrationBuilder.DropColumn(
                name: "AzureAdClientSecret",
                table: "TenantConfiguracoes");

            migrationBuilder.DropColumn(
                name: "AzureAdTenantId",
                table: "TenantConfiguracoes");
        }
    }
}
