-- Migration: Add RecruiterMatchingFeedbacks table
-- Date: 2026-03-27
-- Purpose: Track recruiter actions on matched candidates for NDCG quality metrics

CREATE TABLE IF NOT EXISTS "RecruiterMatchingFeedbacks" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "TenantId" character varying(64) NOT NULL,
    "VagaId" uuid NOT NULL,
    "CandidatoId" uuid NOT NULL,
    "RecruiterUserId" character varying(120),
    "Action" smallint NOT NULL DEFAULT 0,
    "MatchScoreAtAction" integer,
    "RankPositionAtAction" integer,
    "CreatedAtUtc" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "IX_RecruiterMatchingFeedbacks_VagaId_CandidatoId"
    ON "RecruiterMatchingFeedbacks" ("VagaId", "CandidatoId");

CREATE INDEX IF NOT EXISTS "IX_RecruiterMatchingFeedbacks_TenantId_VagaId"
    ON "RecruiterMatchingFeedbacks" ("TenantId", "VagaId");
