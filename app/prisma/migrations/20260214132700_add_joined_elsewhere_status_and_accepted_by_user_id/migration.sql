-- AlterEnum
ALTER TYPE "InviteStatus" ADD VALUE 'joined_elsewhere';

-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "accepted_by_user_id" UUID;

-- CreateIndex
CREATE INDEX "invites_accepted_by_user_id_idx" ON "invites"("accepted_by_user_id");

-- RenameIndex
ALTER INDEX "item_image_details_colors_gin_idx" RENAME TO "item_image_details_colors_idx";
