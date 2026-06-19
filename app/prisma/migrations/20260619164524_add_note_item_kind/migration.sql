-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'note';

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'compose';

-- CreateTable
CREATE TABLE "item_note_details" (
    "item_id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_note_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_note_details" ADD CONSTRAINT "item_note_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

