-- DropIndex
DROP INDEX "items_processing_status_updated_at_idx";

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "processing_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "items_processing_status_processing_started_at_idx" ON "items"("processing_status", "processing_started_at");
