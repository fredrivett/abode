-- Add vector columns (Prisma doesn't support pgvector type natively)
-- Visual embeddings: CLIP ViT-B/32 produces 768-dimensional vectors
ALTER TABLE "item_visual_vectors" ADD COLUMN "embedding" vector(768);

-- Text embeddings: OpenAI text-embedding-3-small produces 1536-dimensional vectors
ALTER TABLE "item_text_vectors" ADD COLUMN "embedding" vector(1536);

-- Create HNSW indexes for fast similarity search using inner product
-- Visual embeddings index
CREATE INDEX "item_visual_vectors_embedding_idx" ON "item_visual_vectors" USING hnsw ("embedding" vector_ip_ops);

-- Text embeddings index
CREATE INDEX "item_text_vectors_embedding_idx" ON "item_text_vectors" USING hnsw ("embedding" vector_ip_ops);

-- Enable RLS and create policies (only if auth schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- Enable RLS on visual vectors table
    ALTER TABLE "item_visual_vectors" ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can manage own visual vectors" ON "item_visual_vectors"
    FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = "user_id")
    WITH CHECK ((SELECT auth.uid()) = "user_id");

    -- Enable RLS on text vectors table
    ALTER TABLE "item_text_vectors" ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can manage own text vectors" ON "item_text_vectors"
    FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = "user_id")
    WITH CHECK ((SELECT auth.uid()) = "user_id");
  END IF;
END $$;
