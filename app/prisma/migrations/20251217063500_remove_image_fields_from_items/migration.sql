-- DropIndex (objects column being removed)
DROP INDEX IF EXISTS "items_objects_idx";

-- AlterTable - Remove image-specific columns from items (now in item_image_details)
ALTER TABLE "items" DROP COLUMN IF EXISTS "colors";
ALTER TABLE "items" DROP COLUMN IF EXISTS "objects";
ALTER TABLE "items" DROP COLUMN IF EXISTS "ocr_text";
ALTER TABLE "items" DROP COLUMN IF EXISTS "vision_data";
