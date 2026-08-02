-- CreateEnum
CREATE TYPE "BookReadingStatus" AS ENUM ('want_to_read', 'reading', 'read', 'dnf');

-- CreateEnum
CREATE TYPE "BookProgressUnit" AS ENUM ('page', 'percent');

-- AlterTable
ALTER TABLE "item_book_details" ADD COLUMN     "finished_at" TIMESTAMP(3),
ADD COLUMN     "progress_unit" "BookProgressUnit" NOT NULL DEFAULT 'page',
ADD COLUMN     "progress_updated_at" TIMESTAMP(3),
ADD COLUMN     "progress_value" INTEGER,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "status" "BookReadingStatus";
