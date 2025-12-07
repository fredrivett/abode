-- AlterTable
ALTER TABLE "items" ADD COLUMN     "colors" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "objects" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ocr_text" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "title" TEXT,
ADD COLUMN     "vision_data" JSONB;

-- CreateIndex
CREATE INDEX "items_tags_idx" ON "items"("tags");

-- CreateIndex
CREATE INDEX "items_objects_idx" ON "items"("objects");
