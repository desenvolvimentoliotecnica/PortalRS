using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAguardandoDecisaoRHAndAddPrazoDataAlvo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Nova coluna: DecisaoRHPrazoDataAlvo (DateTimeOffset? alvo do provisório)
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DecisaoRHPrazoDataAlvo",
                table: "SolicitacoesVaga",
                type: "timestamp with time zone",
                nullable: true);

            // 2. Data fix: migrar registros em AguardandoDecisaoRH (status=9) para Aprovada (status=2).
            //    A partir desta release o gestor preenche a DecisaoRH na criação — o estado 9 deixa de existir.
            //    Envelopado em DO block para ser idempotente quando a tabela não existe (banco owner/master).
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                               JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                               WHERE n.nspname='public' AND c.relname='SolicitacoesVaga') THEN
                        UPDATE ""SolicitacoesVaga"" SET ""Status"" = 2 WHERE ""Status"" = 9;
                    END IF;
                END $$;");

            // 3. Cancelar etapas de aprovação pendentes cujo label era o passo manual do RH decidir headcount.
            //    Evita etapas órfãs bloqueando o fluxo após o status foi consolidado.
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                               JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                               WHERE n.nspname='public' AND c.relname='SolicitacoesAprovacaoEtapa') THEN
                        UPDATE ""SolicitacoesAprovacaoEtapa""
                        SET ""Status"" = 3,
                            ""DataUtc"" = now()
                        WHERE ""Status"" = 0
                          AND ""Label"" = 'Decisão de Headcount — RH';
                    END IF;
                END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Down não restaura registros já migrados (9 → 2) porque não temos como distinguir dos
            // que nasceram em 2. A coluna é dropada para reverter o schema.
            migrationBuilder.DropColumn(
                name: "DecisaoRHPrazoDataAlvo",
                table: "SolicitacoesVaga");
        }
    }
}
