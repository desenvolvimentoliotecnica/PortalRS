-- Migration: Add pgvector embedding support for Talentos table
-- Enables vector similarity search across the talent bank

-- 1. Add embedding columns to Talentos table
ALTER TABLE "Talentos" 
  ADD COLUMN IF NOT EXISTS "Embedding" vector(1536),
  ADD COLUMN IF NOT EXISTS "EmbeddingGeneratedAtUtc" timestamp with time zone;

-- 2. Create IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_talentos_embedding 
  ON "Talentos" USING ivfflat ("Embedding" vector_cosine_ops) 
  WITH (lists = 100);

-- 3. Index for searching talentos with embeddings by tenant
CREATE INDEX IF NOT EXISTS idx_talentos_tenant_embedding 
  ON "Talentos" ("TenantId") 
  WHERE "Embedding" IS NOT NULL;

-- Comments
COMMENT ON COLUMN "Talentos"."Embedding" IS 'Vector embedding (1536 dimensions) for semantic search using text-embedding-3-small';
