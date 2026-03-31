-- Migration: Add sub-score columns to CandidatoVagaMatchingScores
-- Date: 2026-03-27
-- Purpose: Store dimensional scores (competencia, experiencia, formacao, localidade)
--          to eliminate JSON blob dependency in VagaUnifiedMatchingCaches.ItemsJson

ALTER TABLE "CandidatoVagaMatchingScores"
    ADD COLUMN IF NOT EXISTS "ScoreCompetencia" integer,
    ADD COLUMN IF NOT EXISTS "ScoreExperiencia" integer,
    ADD COLUMN IF NOT EXISTS "ScoreFormacao" integer,
    ADD COLUMN IF NOT EXISTS "ScoreLocalidade" integer,
    ADD COLUMN IF NOT EXISTS "Source" character varying(20),
    ADD COLUMN IF NOT EXISTS "Justificativa" character varying(2000),
    ADD COLUMN IF NOT EXISTS "RuleVersion" character varying(30);
