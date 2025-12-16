-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('upload', 'url');

-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'article';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "cover_file_key" TEXT,
ADD COLUMN     "source_url" TEXT,
ALTER COLUMN "kind" DROP NOT NULL,
ALTER COLUMN "source_type" TYPE "SourceType" USING "source_type"::text::"SourceType";

-- CreateTable
CREATE TABLE "item_article_details" (
    "item_id" UUID NOT NULL,
    "author" TEXT,
    "domain" TEXT,
    "published_at" TIMESTAMP(3),
    "reading_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_article_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_article_details" ADD CONSTRAINT "item_article_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
