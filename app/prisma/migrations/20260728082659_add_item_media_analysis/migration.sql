-- CreateTable
CREATE TABLE "item_media_analysis" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "objects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" JSONB,
    "ocr_text" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vision_data" JSONB,
    "embedding" vector,
    "embedding_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_media_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_media_analysis_item_id_idx" ON "item_media_analysis"("item_id");

-- CreateIndex
CREATE INDEX "item_media_analysis_user_id_idx" ON "item_media_analysis"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_media_analysis_item_id_file_key_key" ON "item_media_analysis"("item_id", "file_key");

-- AddForeignKey
ALTER TABLE "item_media_analysis" ADD CONSTRAINT "item_media_analysis_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_media_analysis" ADD CONSTRAINT "item_media_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable Row Level Security (default-deny) on item_media_analysis, matching every
-- other app table. Accessed only server-side via Prisma (owner role, which
-- bypasses RLS); the anon/authenticated Supabase roles get no access.
ALTER TABLE "item_media_analysis" ENABLE ROW LEVEL SECURITY;
