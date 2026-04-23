using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEfetivacaoManualToIntegracoes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesDesligamento"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesPromocao"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesEndereco"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesDependente"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesBeneficio"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesFerias"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;

                ALTER TABLE "SolicitacoesVaga"
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmentePorId"  uuid                     NULL,
                    ADD COLUMN IF NOT EXISTS "EfetivadoManualmenteEmUtc"  timestamp with time zone NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesDesligamento"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesPromocao"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesPagamentoExtra"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesEndereco"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesDependente"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesBeneficio"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesFerias"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";

                ALTER TABLE "SolicitacoesVaga"
                    DROP COLUMN IF EXISTS "EfetivadoManualmentePorId",
                    DROP COLUMN IF EXISTS "EfetivadoManualmenteEmUtc";
                """);
        }
    }
}
