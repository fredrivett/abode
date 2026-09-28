-- CreateEnum
CREATE TYPE "DocumentPageFilter" AS ENUM ('bw', 'grey', 'original');

-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'document';

-- CreateTable
CREATE TABLE "item_document_pages" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "file_key" TEXT NOT NULL,
    "original_file_key" TEXT NOT NULL,
    "filter" "DocumentPageFilter" NOT NULL DEFAULT 'bw',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "ocr_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_document_pages_item_id_position_idx" ON "item_document_pages"("item_id", "position");

-- AddForeignKey
ALTER TABLE "item_document_pages" ADD CONSTRAINT "item_document_pages_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default-deny RLS: pages are only read and written server-side through Prisma
-- (which bypasses RLS), never by the anon/authenticated Supabase roles
ALTER TABLE "item_document_pages" ENABLE ROW LEVEL SECURITY;
