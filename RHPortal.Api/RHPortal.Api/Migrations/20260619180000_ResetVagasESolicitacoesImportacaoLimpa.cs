using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <summary>
/// Reset DEV/HML: remove todas as solicitações de vaga e vagas importadas/criadas,
/// preparando importação limpa do RM (AUMENTO_QUADRO + SUBSTITUICAO).
/// </summary>
public partial class ResetVagasESolicitacoesImportacaoLimpa : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            -- Desvincula pré-admissões (FK SetNull ao excluir vaga; garantimos antes por clareza)
            UPDATE "PreAdmissoes" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;

            -- Pipeline de candidaturas ligadas a vagas
            DELETE FROM "CandidaturaEtapaHistoricos" h
            USING "Candidaturas" c
            WHERE h."CandidaturaId" = c."Id" AND c."VagaId" IS NOT NULL;

            DELETE FROM "Candidaturas" WHERE "VagaId" IS NOT NULL;

            DELETE FROM "CandidatoVagaLlmScores" WHERE "VagaId" IS NOT NULL;
            DELETE FROM "CandidatoVagaMatchingScores" WHERE "VagaId" IS NOT NULL;
            DELETE FROM "VagaUnifiedMatchingCaches" WHERE "VagaId" IS NOT NULL;
            DELETE FROM "BatchMatchingRunVagas" WHERE "VagaId" IS NOT NULL;
            DELETE FROM "PropostasVaga" WHERE "VagaId" IS NOT NULL;

            DELETE FROM "FasesProcesso" f
            USING "ProjetosVaga" p
            WHERE f."ProjetoId" = p."Id";

            DELETE FROM "ProjetosVaga";
            DELETE FROM "RespostasCampoPersonalizadoVaga";
            DELETE FROM "CamposPersonalizadosVaga";
            DELETE FROM "VagaPerguntas";
            DELETE FROM "VagaEtapas";
            DELETE FROM "VagaRequisitos";
            DELETE FROM "VagaBeneficios";
            DELETE FROM "EixosVaga";
            DELETE FROM "HistoricosAlteracaoWorkflowRH" w
            USING "WorkflowsRH" wf
            WHERE w."WorkflowId" = wf."Id" AND wf."VagaId" IS NOT NULL;
            DELETE FROM "WorkflowsRH" WHERE "VagaId" IS NOT NULL;

            -- Solicitações de vaga e dependências
            DELETE FROM "RmRequisicaoPareceres";
            DELETE FROM "SolicitacaoVagaIndicacoes";
            DELETE FROM "SolicitacaoVagaIntegracaoTentativas";
            DELETE FROM "SolicitacoesAprovacaoEtapa" e
            USING "SolicitacoesVaga" s
            WHERE e."SolicitacaoId" = s."Id";
            DELETE FROM "HistoricosStatus" h
            WHERE h."TipoEntidade" = 1;

            UPDATE "SolicitacoesVaga" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;
            DELETE FROM "SolicitacoesVaga";
            DELETE FROM "Vagas";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Reset destrutivo — não há rollback de dados.
    }
}
