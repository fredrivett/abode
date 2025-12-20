/*
  Warnings:

  - A unique constraint covering the columns `[user_id,slug]` on the table `rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "rooms_user_id_slug_key" ON "rooms"("user_id", "slug");
