-- Enable pgvector extension (Prisma doesn't support this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to item_vectors (Prisma doesn't support vector type)
ALTER TABLE "item_vectors" ADD COLUMN "embedding" vector(512);

-- Create HNSW index for fast similarity search using inner product
CREATE INDEX "item_vectors_embedding_idx" ON "item_vectors" USING hnsw ("embedding" vector_ip_ops);

-- Enable RLS and create policies (only if auth schema exists)
-- This allows shadow database validation to succeed while production DB gets full RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- Enable RLS on items table for multi-tenant data isolation
    ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can manage own items" ON "items"
    FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = "user_id")
    WITH CHECK ((SELECT auth.uid()) = "user_id");

    -- Enable RLS on item_vectors table for multi-tenant data isolation
    ALTER TABLE "item_vectors" ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can manage own vectors" ON "item_vectors"
    FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = "user_id")
    WITH CHECK ((SELECT auth.uid()) = "user_id");
  END IF;
END $$;
