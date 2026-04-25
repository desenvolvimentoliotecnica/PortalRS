using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIntegracaoRetry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Adiciona TentativasIntegracao e UltimaTentativaUtc nas 8 entidades integráveis.
            // IF NOT EXISTS garante idempotência em bancos de tenants mais antigos.
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesDesligamento"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesPromocao"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesEndereco"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesDependente"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesBeneficio"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesFerias"
                    ADD COLUMN IF NOT EXISTS "TentativasIntegracao" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "UltimaTentativaUtc" timestamp with time zone NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in new[]
            {
                "PreAdmissoes", "SolicitacoesDesligamento", "SolicitacoesPromocao",
                "SolicitacoesPagamentoExtra", "SolicitacoesEndereco",
                "SolicitacoesDependente", "SolicitacoesBeneficio", "SolicitacoesFerias"
            })
            {
                migrationBuilder.DropColumn(name: "TentativasIntegracao", table: table);
                migrationBuilder.DropColumn(name: "UltimaTentativaUtc", table: table);
            }
        }
    }
}
