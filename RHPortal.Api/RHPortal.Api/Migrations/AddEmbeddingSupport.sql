-- Migration: Add pgvector support for embeddings
-- Fixed version without quotes for PostgreSQL compatibility

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding columns to Vagas table
ALTER TABLE "Vagas" 
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_generated_at_utc timestamp with time zone;

-- 3. Add embedding columns to Candidatos table
ALTER TABLE "Candidatos" 
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_generated_at_utc timestamp with time zone;

-- 4. Create indexes for fast similarity search
CREATE INDEX IF NOT EXISTS idx_vagas_embedding 
  ON "Vagas" USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_candidatos_embedding 
  ON "Candidatos" USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- 5. Index for searching candidates with embeddings by tenant
CREATE INDEX IF NOT EXISTS idx_candidatos_tenant_embedding 
  ON "Candidatos" ("TenantId") 
  WHERE embedding IS NOT NULL;

-- 6. Index for searching vagas with embeddings by tenant
CREATE INDEX IF NOT EXISTS idx_vagas_tenant_embedding 
  ON "Vagas" ("TenantId") 
  WHERE embedding IS NOT NULL;

-- Comments
COMMENT ON COLUMN "Vagas".embedding IS 'Vector embedding (1536 dimensions) for semantic search using text-embedding-3-small';
COMMENT ON COLUMN "Candidatos".embedding IS 'Vector embedding (1536 dimensions) for semantic search using text-embedding-3-small';
