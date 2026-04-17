using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSlaAprovacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ──────────────────────────────────────────────────────────────
            // TenantConfiguracoes: SLA defaults (48h lembrete, 96h escalação)
            // ──────────────────────────────────────────────────────────────
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                    ADD COLUMN IF NOT EXISTS "SlaAprovacaoHoras" integer NOT NULL DEFAULT 48,
                    ADD COLUMN IF NOT EXISTS "SlaEscalacaoHoras" integer NOT NULL DEFAULT 96;
                """);

            // ──────────────────────────────────────────────────────────────
            // SolicitacoesAprovacaoEtapas: campos de SLA + rastreamento
            // CreatedAtUtc default now() para novas etapas;
            // etapas existentes também recebem now() (evita lembrete em massa no deploy).
            // ──────────────────────────────────────────────────────────────
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesAprovacaoEtapas"
                    ADD COLUMN IF NOT EXISTS "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
                    ADD COLUMN IF NOT EXISTS "LembretesEnviados" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimoLembreteUtc" timestamp with time zone NULL,
                    ADD COLUMN IF NOT EXISTS "EscaladoEmUtc" timestamp with time zone NULL;
                """);

            // ──────────────────────────────────────────────────────────────
            // EtapasConfigAprovacao: override opcional de SLA por etapa
            // ──────────────────────────────────────────────────────────────
            migrationBuilder.Sql("""
                ALTER TABLE "EtapasConfigAprovacao"
                    ADD COLUMN IF NOT EXISTS "SlaHoras" integer NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SlaAprovacaoHoras",
                table: "TenantConfiguracoes");

            migrationBuilder.DropColumn(
                name: "SlaEscalacaoHoras",
                table: "TenantConfiguracoes");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "SolicitacoesAprovacaoEtapas");

            migrationBuilder.DropColumn(
                name: "LembretesEnviados",
                table: "SolicitacoesAprovacaoEtapas");

            migrationBuilder.DropColumn(
                name: "UltimoLembreteUtc",
                table: "SolicitacoesAprovacaoEtapas");

            migrationBuilder.DropColumn(
                name: "EscaladoEmUtc",
                table: "SolicitacoesAprovacaoEtapas");

            migrationBuilder.DropColumn(
                name: "SlaHoras",
                table: "EtapasConfigAprovacao");
        }
    }
}
