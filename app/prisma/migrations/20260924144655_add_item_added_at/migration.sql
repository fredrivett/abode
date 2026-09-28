-- AlterTable
-- New column defaults to now() for future inserts; existing rows are backfilled
-- from created_at below so their library timeline position is preserved (not
-- reset to the migration time). Imports later backdate added_at to the source's
-- own "added" date.
ALTER TABLE "items" ADD COLUMN     "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "items" SET "added_at" = "created_at";

-- CreateIndex
CREATE INDEX "items_user_id_added_at_idx" ON "items"("user_id", "added_at" DESC);
