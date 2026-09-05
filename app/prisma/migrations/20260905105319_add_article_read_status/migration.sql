-- AlterTable
ALTER TABLE "item_article_details" ADD COLUMN     "progress_updated_at" TIMESTAMP(3),
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "scroll_progress" DOUBLE PRECISION;
