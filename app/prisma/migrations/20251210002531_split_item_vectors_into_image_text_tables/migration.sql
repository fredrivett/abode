/*
  Warnings:

  - You are about to drop the `item_vectors` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "item_vectors" DROP CONSTRAINT "item_vectors_item_id_fkey";

-- DropForeignKey
ALTER TABLE "item_vectors" DROP CONSTRAINT "item_vectors_user_id_fkey";

-- DropTable
DROP TABLE "item_vectors";

-- DropEnum
DROP TYPE "VectorKind";

-- CreateTable
CREATE TABLE "item_visual_vectors" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_visual_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_text_vectors" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_text_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_visual_vectors_item_id_idx" ON "item_visual_vectors"("item_id");

-- CreateIndex
CREATE INDEX "item_visual_vectors_user_id_idx" ON "item_visual_vectors"("user_id");

-- CreateIndex
CREATE INDEX "item_text_vectors_item_id_idx" ON "item_text_vectors"("item_id");

-- CreateIndex
CREATE INDEX "item_text_vectors_user_id_idx" ON "item_text_vectors"("user_id");

-- AddForeignKey
ALTER TABLE "item_visual_vectors" ADD CONSTRAINT "item_visual_vectors_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_visual_vectors" ADD CONSTRAINT "item_visual_vectors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_text_vectors" ADD CONSTRAINT "item_text_vectors_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_text_vectors" ADD CONSTRAINT "item_text_vectors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
