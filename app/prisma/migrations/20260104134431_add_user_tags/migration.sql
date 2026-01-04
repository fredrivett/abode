-- AlterTable
ALTER TABLE "items" ADD COLUMN     "user_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "items_user_tags_idx" ON "items"("user_tags");
