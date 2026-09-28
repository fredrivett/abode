-- AlterEnum
ALTER TYPE "CaptureSource" ADD VALUE 'api';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "personal_access_token_id" UUID;

-- CreateIndex
CREATE INDEX "items_personal_access_token_id_idx" ON "items"("personal_access_token_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_personal_access_token_id_fkey" FOREIGN KEY ("personal_access_token_id") REFERENCES "personal_access_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
