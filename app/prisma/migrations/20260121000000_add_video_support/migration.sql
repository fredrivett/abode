-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'video';

-- CreateTable
CREATE TABLE "item_video_details" (
    "item_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "channel_name" TEXT,
    "channel_url" TEXT,
    "duration" INTEGER,
    "embed_url" TEXT,
    "thumbnail_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_video_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_video_details" ADD CONSTRAINT "item_video_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
