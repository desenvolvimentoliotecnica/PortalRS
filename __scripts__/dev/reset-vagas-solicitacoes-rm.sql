-- Reset DEV/HML: limpa vagas e solicitações de vaga para importação RM do zero.
-- Mesma lógica da migration 20260619180000_ResetVagasESolicitacoesImportacaoLimpa.
-- Executar no banco do tenant (ex.: dev_render_owner ou tenant específico).

BEGIN;

UPDATE "PreAdmissoes" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;

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

UPDATE "Candidatos" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;
UPDATE "CandidatoDocumentos" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;
UPDATE "CandidatoPortalNotificacoes" SET "VagaId" = NULL, "CandidaturaId" = NULL WHERE "VagaId" IS NOT NULL OR "CandidaturaId" IS NOT NULL;
UPDATE "InboxItems" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;
DELETE FROM "RecruiterMatchingFeedbacks" WHERE "VagaId" IS NOT NULL;

DELETE FROM "RmRequisicaoPareceres";
DELETE FROM "SolicitacaoVagaIndicacoes";
DELETE FROM "SolicitacaoVagaIntegracaoTentativas";
DELETE FROM "SolicitacoesAprovacaoEtapas" e
USING "SolicitacoesVaga" s
WHERE e."SolicitacaoId" = s."Id";
DELETE FROM "HistoricosStatus" h
WHERE h."TipoEntidade" = 1;

UPDATE "SolicitacoesVaga" SET "VagaId" = NULL WHERE "VagaId" IS NOT NULL;
DELETE FROM "SolicitacoesVaga";
DELETE FROM "Vagas";

COMMIT;
