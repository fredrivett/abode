/*
  Warnings:

  - A unique constraint covering the columns `[user_id,auto_kind]` on the table `rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RoomAutoKind" AS ENUM ('book_want_to_read', 'book_reading', 'book_read');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "auto_kind" "RoomAutoKind";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dismissed_auto_rooms" "RoomAutoKind"[] DEFAULT ARRAY[]::"RoomAutoKind"[];

-- CreateIndex
CREATE UNIQUE INDEX "rooms_user_id_auto_kind_key" ON "rooms"("user_id", "auto_kind");
