-- Migration: Add BatchMatchingRuns and BatchMatchingRunVagas tables
-- Date: 2026-03-27
-- Purpose: Track batch matching runs for overnight processing

CREATE TABLE IF NOT EXISTS "BatchMatchingRuns" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "TenantId" character varying(64) NOT NULL,
    "Status" smallint NOT NULL DEFAULT 0,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "StartedAtUtc" timestamp with time zone,
    "CompletedAtUtc" timestamp with time zone,
    "TotalVagas" integer NOT NULL DEFAULT 0,
    "ProcessedVagas" integer NOT NULL DEFAULT 0,
    "FailedVagas" integer NOT NULL DEFAULT 0,
    "TotalCandidatesScored" integer NOT NULL DEFAULT 0,
    "LastProcessedVagaId" uuid,
    "LastError" character varying(2000)
);

CREATE INDEX IF NOT EXISTS "IX_BatchMatchingRuns_TenantId_CreatedAtUtc"
    ON "BatchMatchingRuns" ("TenantId", "CreatedAtUtc");

CREATE TABLE IF NOT EXISTS "BatchMatchingRunVagas" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "RunId" uuid NOT NULL REFERENCES "BatchMatchingRuns"("Id") ON DELETE CASCADE,
    "VagaId" uuid NOT NULL,
    "TenantId" character varying(64) NOT NULL,
    "Status" smallint NOT NULL DEFAULT 0,
    "ScoresGenerated" integer NOT NULL DEFAULT 0,
    "StartedAtUtc" timestamp with time zone,
    "CompletedAtUtc" timestamp with time zone,
    "ErrorMessage" character varying(2000)
);

CREATE INDEX IF NOT EXISTS "IX_BatchMatchingRunVagas_RunId"
    ON "BatchMatchingRunVagas" ("RunId");
