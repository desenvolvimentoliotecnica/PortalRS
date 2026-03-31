-- Migration: Add Skills Taxonomy tables
-- Date: 2026-03-27
-- Purpose: Global skills taxonomy with aliases and hierarchy for matching

-- Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "Skills" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "TenantId" character varying(64) NOT NULL,
    "CanonicalName" character varying(180) NOT NULL,
    "Category" character varying(80),
    "ParentSkillId" uuid REFERENCES "Skills"("Id") ON DELETE SET NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Skills_TenantId_CanonicalName"
    ON "Skills" ("TenantId", "CanonicalName");

CREATE TABLE IF NOT EXISTS "SkillAliases" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "TenantId" character varying(64) NOT NULL,
    "SkillId" uuid NOT NULL REFERENCES "Skills"("Id") ON DELETE CASCADE,
    "AliasName" character varying(180) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_SkillAliases_TenantId_AliasName"
    ON "SkillAliases" ("TenantId", "AliasName");

-- GIN trigram index for fuzzy search
CREATE INDEX IF NOT EXISTS "IX_SkillAliases_AliasName_trgm"
    ON "SkillAliases" USING gin ("AliasName" gin_trgm_ops);

-- Add optional SkillId FK on VagaRequisitos
ALTER TABLE "VagaRequisitos"
    ADD COLUMN IF NOT EXISTS "SkillId" uuid REFERENCES "Skills"("Id") ON DELETE SET NULL;
