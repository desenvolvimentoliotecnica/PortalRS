-- ============================================================================
-- LIMPEZA DE APRESENTACAO - Requisicoes/Vagas criadas no Portal ou UAT
-- ============================================================================
-- Objetivo:
--   Limpar requisicoes, vagas e dados de processo seletivo criados manualmente
--   no Portal ou por testes automatizados, preservando dados sincronizados do RM.
--
-- Como usar:
--   1. Ajuste o TenantId abaixo, se necessario.
--   2. Rode o script primeiro como esta. Ele termina com ROLLBACK e mostra as
--      contagens que seriam apagadas.
--   3. Se a previa estiver correta, troque o ROLLBACK final por COMMIT e rode de
--      novo.
--
-- Criterio de preservacao RM:
--   - Vagas com "IdReqRmOrigem" preenchido, "UltimoCicloRmObservadoUtc"
--     preenchido ou "OrigemTipo" diferente de Manual(0) sao preservadas.
--   - Solicitacoes com "RmIdReq" ou "RmRequisicaoCodigo" real preenchidos sao
--     preservadas. Vinculos STUB-* sao considerados dados de teste e entram na
--     limpeza.
--
-- Importante:
--   O script NAO apaga Funcionarios, Users, configuracoes, cargos, hierarquias,
--   centros de custo, dados de sync RM, candidatos ou curriculos. Ele apenas
--   desvincula candidatos/curriculos das vagas removidas.
-- ============================================================================

BEGIN;

SET client_min_messages TO WARNING;

-- Ajuste aqui caso precise limpar outro tenant.
CREATE TEMP TABLE cleanup_params (
  tenant_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO cleanup_params (tenant_id)
VALUES ('liotecnica');

-- Vagas criadas no Portal/testes: sem evidencias de origem RM.
CREATE TEMP TABLE cleanup_vagas AS
SELECT v."Id"
FROM "Vagas" v
JOIN cleanup_params p ON p.tenant_id = v."TenantId"
WHERE COALESCE(v."OrigemTipo", 0) = 0
  AND NULLIF(BTRIM(COALESCE(v."IdReqRmOrigem", '')), '') IS NULL
  AND v."UltimoCicloRmObservadoUtc" IS NULL;

-- Solicitacoes criadas no Portal/testes: sem vinculo RM real, ou ligadas a vaga
-- que tambem sera removida. STUB-* e considerado dado artificial/teste.
CREATE TEMP TABLE cleanup_solicitacoes AS
SELECT s."Id"
FROM "SolicitacoesVaga" s
JOIN cleanup_params p ON p.tenant_id = s."TenantId"
WHERE (
    s."VagaId" IN (SELECT "Id" FROM cleanup_vagas)
    OR (
      s."RmIdReq" IS NULL
      AND (
        NULLIF(BTRIM(COALESCE(s."RmRequisicaoCodigo", '')), '') IS NULL
        OR s."RmRequisicaoCodigo" ILIKE 'STUB-%'
      )
    )
  );

CREATE TEMP TABLE cleanup_candidaturas AS
SELECT c."Id"
FROM "Candidaturas" c
JOIN cleanup_params p ON p.tenant_id = c."TenantId"
WHERE c."VagaId" IN (SELECT "Id" FROM cleanup_vagas);

CREATE TEMP TABLE cleanup_preadmissoes AS
SELECT pa."Id"
FROM "PreAdmissoes" pa
JOIN cleanup_params p ON p.tenant_id = pa."TenantId"
WHERE pa."VagaId" IN (SELECT "Id" FROM cleanup_vagas);

CREATE TEMP TABLE cleanup_workflows AS
SELECT w."Id"
FROM "WorkflowsRH" w
JOIN cleanup_params p ON p.tenant_id = w."TenantId"
WHERE w."VagaId" IN (SELECT "Id" FROM cleanup_vagas)
   OR w."PreAdmissaoId" IN (SELECT "Id" FROM cleanup_preadmissoes);

-- ============================================================================
-- PREVIA
-- ============================================================================

SELECT 'Tenant alvo' AS item, tenant_id AS quantidade
FROM cleanup_params
UNION ALL
SELECT 'Vagas Portal/UAT a remover', COUNT(*)::text FROM cleanup_vagas
UNION ALL
SELECT 'Solicitacoes Portal/UAT a remover', COUNT(*)::text FROM cleanup_solicitacoes
UNION ALL
SELECT 'Candidaturas vinculadas a remover', COUNT(*)::text FROM cleanup_candidaturas
UNION ALL
SELECT 'Pre-admissoes vinculadas a remover', COUNT(*)::text FROM cleanup_preadmissoes
UNION ALL
SELECT 'Workflows RH vinculados a remover', COUNT(*)::text FROM cleanup_workflows
UNION ALL
SELECT 'Vagas RM preservadas', COUNT(*)::text
FROM "Vagas" v
JOIN cleanup_params p ON p.tenant_id = v."TenantId"
WHERE v."Id" NOT IN (SELECT "Id" FROM cleanup_vagas)
  AND (
    COALESCE(v."OrigemTipo", 0) <> 0
    OR NULLIF(BTRIM(COALESCE(v."IdReqRmOrigem", '')), '') IS NOT NULL
    OR v."UltimoCicloRmObservadoUtc" IS NOT NULL
  )
UNION ALL
SELECT 'Solicitacoes com vinculo RM preservadas', COUNT(*)::text
FROM "SolicitacoesVaga" s
JOIN cleanup_params p ON p.tenant_id = s."TenantId"
WHERE s."Id" NOT IN (SELECT "Id" FROM cleanup_solicitacoes)
  AND (
    s."RmIdReq" IS NOT NULL
    OR (
      NULLIF(BTRIM(COALESCE(s."RmRequisicaoCodigo", '')), '') IS NOT NULL
      AND s."RmRequisicaoCodigo" NOT ILIKE 'STUB-%'
    )
  );

-- ============================================================================
-- LIMPEZA EM ORDEM REVERSA DE DEPENDENCIAS
-- ============================================================================

-- Candidatos e curriculos sao preservados; apenas removemos referencias para as
-- vagas que vao sair.
UPDATE "Candidatos"
SET "VagaId" = NULL,
    "LastMatchVagaId" = NULL
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND ("VagaId" IN (SELECT "Id" FROM cleanup_vagas)
       OR "LastMatchVagaId" IN (SELECT "Id" FROM cleanup_vagas));

UPDATE "CandidatoDocumentos"
SET "VagaId" = NULL
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

UPDATE "InboxItems"
SET "VagaId" = NULL
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

-- Pre-admissao e anexos do fluxo.
DELETE FROM "PreAdmissaoDocumentos"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "PreAdmissaoId" IN (SELECT "Id" FROM cleanup_preadmissoes);

DELETE FROM "PreAdmissaoDocumentosSolicitados"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "PreAdmissaoId" IN (SELECT "Id" FROM cleanup_preadmissoes);

DELETE FROM "PreAdmissaoDependentes"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "PreAdmissaoId" IN (SELECT "Id" FROM cleanup_preadmissoes);

DELETE FROM "PreAdmissoes"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "Id" IN (SELECT "Id" FROM cleanup_preadmissoes);

-- Workflows operacionais vinculados as vagas/pre-admissoes removidas.
DELETE FROM "HistoricosAlteracaoWorkflowRH"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "WorkflowId" IN (SELECT "Id" FROM cleanup_workflows);

DELETE FROM "EtapasWorkflowRH"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "WorkflowId" IN (SELECT "Id" FROM cleanup_workflows);

DELETE FROM "WorkflowsRH"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "Id" IN (SELECT "Id" FROM cleanup_workflows);

-- Recrutamento e selecao.
DELETE FROM "AgendaEvents"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND (
    "VagaId" IN (SELECT "Id" FROM cleanup_vagas)
    OR "CandidaturaId" IN (SELECT "Id" FROM cleanup_candidaturas)
  );

DELETE FROM "NotificacoesCandidaturaLogs"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "CandidaturaId" IN (SELECT "Id" FROM cleanup_candidaturas);

DELETE FROM "PropostasVaga"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND (
    "VagaId" IN (SELECT "Id" FROM cleanup_vagas)
    OR "CandidaturaId" IN (SELECT "Id" FROM cleanup_candidaturas)
  );

DELETE FROM "CandidaturaEtapaHistoricos"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "CandidaturaId" IN (SELECT "Id" FROM cleanup_candidaturas);

DELETE FROM "Candidaturas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "Id" IN (SELECT "Id" FROM cleanup_candidaturas);

DELETE FROM "CandidatoVagaMatchingScores"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "CandidatoVagaLlmScores"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "VagaUnifiedMatchingCaches"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "RecruiterMatchingFeedbacks"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "BatchMatchingRunVagas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

-- Solicitacoes e aprovacao.
DELETE FROM "ApprovalMagicLinks"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "SolicitacaoId" IN (SELECT "Id" FROM cleanup_solicitacoes);

DELETE FROM "SolicitacoesAprovacaoEtapas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "SolicitacaoId" IN (SELECT "Id" FROM cleanup_solicitacoes);

DELETE FROM "SolicitacaoVagaIndicacoes"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "SolicitacaoVagaId" IN (SELECT "Id" FROM cleanup_solicitacoes);

DELETE FROM "SolicitacaoVagaIntegracaoTentativas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "SolicitacaoVagaId" IN (SELECT "Id" FROM cleanup_solicitacoes);

DELETE FROM "HistoricosStatus"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND (
    ("TipoEntidade" = 1 AND "EntidadeId" IN (SELECT "Id" FROM cleanup_solicitacoes)) -- SolicitacaoVaga
    OR ("TipoEntidade" = 9 AND "EntidadeId" IN (SELECT "Id" FROM cleanup_vagas)) -- Vaga
  );

DELETE FROM "SolicitacoesVaga"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "Id" IN (SELECT "Id" FROM cleanup_solicitacoes);

-- Filhas diretas de vaga.
DELETE FROM "OcupacoesHistorico"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "RespostasCampoPersonalizadoVaga"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "CamposPersonalizadosVaga"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "FasesProcesso"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "ProjetoId" IN (
    SELECT "Id"
    FROM "ProjetosVaga"
    WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
      AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas)
  );

DELETE FROM "ProjetosVaga"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "VagaBeneficios"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "VagaRequisitos"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "VagaEtapas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "VagaPerguntas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

DELETE FROM "Vagas"
WHERE "TenantId" = (SELECT tenant_id FROM cleanup_params)
  AND "Id" IN (SELECT "Id" FROM cleanup_vagas);

-- ============================================================================
-- CONFERENCIA POS-LIMPEZA (ainda dentro da transacao)
-- ============================================================================

SELECT 'Restariam vagas Portal/UAT apos limpeza' AS item, COUNT(*)::text AS quantidade
FROM "Vagas" v
JOIN cleanup_params p ON p.tenant_id = v."TenantId"
WHERE COALESCE(v."OrigemTipo", 0) = 0
  AND NULLIF(BTRIM(COALESCE(v."IdReqRmOrigem", '')), '') IS NULL
  AND v."UltimoCicloRmObservadoUtc" IS NULL
UNION ALL
SELECT 'Restariam solicitacoes Portal/UAT apos limpeza', COUNT(*)::text
FROM "SolicitacoesVaga" s
JOIN cleanup_params p ON p.tenant_id = s."TenantId"
WHERE s."RmIdReq" IS NULL
  AND (
    NULLIF(BTRIM(COALESCE(s."RmRequisicaoCodigo", '')), '') IS NULL
    OR s."RmRequisicaoCodigo" ILIKE 'STUB-%'
  )
UNION ALL
SELECT 'Vagas RM preservadas apos limpeza', COUNT(*)::text
FROM "Vagas" v
JOIN cleanup_params p ON p.tenant_id = v."TenantId"
WHERE COALESCE(v."OrigemTipo", 0) <> 0
   OR NULLIF(BTRIM(COALESCE(v."IdReqRmOrigem", '')), '') IS NOT NULL
   OR v."UltimoCicloRmObservadoUtc" IS NOT NULL;

-- SEGURANCA: por padrao NAO grava nada.
-- Para executar a limpeza real, troque ROLLBACK por COMMIT.
ROLLBACK;
