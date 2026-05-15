-- =============================================================================
-- Backfill: VagaId em CandidatoDocumentos (Currículo) para candidatos que já
-- se candidataram à vaga abaixo, mas o arquivo ficou gravado sem VagaId.
--
-- Vaga alvo:
--   791a44fb-cafa-4117-815d-a875888b4d34
--
-- Onde rodar: banco do TENANT (AppDbContext), ex. dev_render_{tenantId}.
-- Não rodar no MasterDb.
--
-- Regras:
--   - Tipo = 0  => CandidateDocumentType.Curriculo (enum C#, primeiro valor).
--   - Só atualiza onde VagaId IS NULL (reexecução segura).
--   - Junta com Candidaturas (mesmo CandidatoId, TenantId, VagaId da vaga).
--
-- Atenção: candidato com um único CV global (VagaId NULL) usado em várias vagas
-- ficará com esse CV associado só a esta vaga após o UPDATE. Demais hubs com
-- outro vagaId podem deixar de listar esse arquivo até novo envio ou outro script.
-- =============================================================================

BEGIN;

-- 1) Pré-visualização (mesmas linhas que o UPDATE afeta)
SELECT d."Id"          AS documento_id,
       d."TenantId",
       d."CandidatoId",
       d."NomeArquivo",
       d."Descricao",
       d."CreatedAtUtc",
       c."Id"          AS candidatura_id,
       c."AplicadaEmUtc"
FROM   "CandidatoDocumentos" AS d
JOIN   "Candidaturas" AS c
       ON c."CandidatoId" = d."CandidatoId"
      AND c."TenantId" = d."TenantId"
      AND c."VagaId" = '791a44fb-cafa-4117-815d-a875888b4d34'::uuid
WHERE  d."Tipo" = 0
  AND  d."VagaId" IS NULL
ORDER BY d."TenantId", d."CandidatoId", d."CreatedAtUtc";

-- 2) Backfill
UPDATE "CandidatoDocumentos" AS d
SET    "VagaId" = '791a44fb-cafa-4117-815d-a875888b4d34'::uuid,
       "UpdatedAtUtc" = NOW()
FROM   "Candidaturas" AS c
WHERE  c."CandidatoId" = d."CandidatoId"
  AND  c."TenantId" = d."TenantId"
  AND  c."VagaId" = '791a44fb-cafa-4117-815d-a875888b4d34'::uuid
  AND  d."Tipo" = 0
  AND  d."VagaId" IS NULL;

-- 3) Conferência (total de currículos ligados à vaga após rodar)
SELECT COUNT(*) AS curriculos_tipo_ligados_a_esta_vaga
FROM   "CandidatoDocumentos"
WHERE  "VagaId" = '791a44fb-cafa-4117-815d-a875888b4d34'::uuid
  AND  "Tipo" = 0;

COMMIT;
-- Se a prévia estiver errada, use ROLLBACK em vez de COMMIT.
