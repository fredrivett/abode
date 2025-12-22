/*
  Warnings:

  - A unique constraint covering the columns `[user_id,slug]` on the table `rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable (add column if not exists)
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- CreateIndex (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_user_id_slug_key" ON "rooms"("user_id", "slug");
