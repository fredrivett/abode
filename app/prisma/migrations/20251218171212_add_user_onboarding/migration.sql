-- DropIndex
DROP INDEX "item_image_details_objects_idx";

-- DropIndex
DROP INDEX "items_search_vector_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3);
