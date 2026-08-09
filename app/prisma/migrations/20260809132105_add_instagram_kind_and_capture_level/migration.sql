-- CreateEnum
CREATE TYPE "CaptureLevel" AS ENUM ('basic', 'full');

-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'instagram';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "capture_level" "CaptureLevel" NOT NULL DEFAULT 'full';

-- CreateTable
CREATE TABLE "item_instagram_details" (
    "item_id" UUID NOT NULL,
    "post_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "author_name" TEXT,
    "author_username" TEXT NOT NULL,
    "caption" TEXT,
    "posted_at" TIMESTAMP(3),
    "media" JSONB,
    "like_count" INTEGER,
    "comment_count" INTEGER,
    "cover_media_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_instagram_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_instagram_details" ADD CONSTRAINT "item_instagram_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (default-deny) on item_instagram_details, matching
-- every other app table. Accessed only server-side via Prisma (owner role, which
-- bypasses RLS); the anon/authenticated Supabase roles get no access.
ALTER TABLE "item_instagram_details" ENABLE ROW LEVEL SECURITY;
