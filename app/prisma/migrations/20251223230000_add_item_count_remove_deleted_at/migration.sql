-- Add item_count column to users with backfill
ALTER TABLE "users" ADD COLUMN "item_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill item counts from existing items
UPDATE "users" SET "item_count" = (
  SELECT COUNT(*) FROM "items" WHERE "items"."user_id" = "users"."id"
);

-- Drop the index on deleted_at before removing the column
DROP INDEX IF EXISTS "items_user_id_deleted_at_idx";

-- Remove deleted_at column from items
ALTER TABLE "items" DROP COLUMN IF EXISTS "deleted_at";

-- Add constraint to prevent negative item counts
ALTER TABLE "users" ADD CONSTRAINT "users_item_count_non_negative" CHECK (item_count >= 0);
