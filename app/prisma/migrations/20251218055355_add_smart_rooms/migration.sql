-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('smart', 'manual');

-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('private', 'public');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "exclude_from_public_rooms" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "filters" JSONB,
    "visibility" "RoomVisibility" NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_items" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_user_id_idx" ON "rooms"("user_id");

-- CreateIndex
CREATE INDEX "room_items_room_id_idx" ON "room_items"("room_id");

-- CreateIndex
CREATE INDEX "room_items_item_id_idx" ON "room_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_items_room_id_item_id_key" ON "room_items"("room_id", "item_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_items" ADD CONSTRAINT "room_items_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_items" ADD CONSTRAINT "room_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
