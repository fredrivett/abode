-- Enable pgvector extension (Prisma doesn't support this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to item_vectors (Prisma doesn't support vector type)
ALTER TABLE "item_vectors" ADD COLUMN "embedding" vector(512);

-- Create HNSW index for fast similarity search using inner product
CREATE INDEX "item_vectors_embedding_idx" ON "item_vectors" USING hnsw ("embedding" vector_ip_ops);

-- Enable RLS on items table for multi-tenant data isolation
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own items" ON "items"
FOR ALL TO authenticated
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());

-- Enable RLS on item_vectors table for multi-tenant data isolation
ALTER TABLE "item_vectors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vectors" ON "item_vectors"
FOR ALL TO authenticated
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
