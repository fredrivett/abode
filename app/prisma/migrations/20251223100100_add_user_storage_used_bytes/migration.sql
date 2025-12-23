-- AlterTable
ALTER TABLE "users" ADD COLUMN "storage_used_bytes" BIGINT NOT NULL DEFAULT 0;

-- Backfill: Calculate current storage usage from existing items
UPDATE "users" u
SET "storage_used_bytes" = COALESCE(
  (SELECT SUM((i.meta->>'size')::bigint)
   FROM "items" i
   WHERE i.user_id = u.id
   AND i.deleted_at IS NULL
   AND i.meta->>'size' IS NOT NULL),
  0
);
