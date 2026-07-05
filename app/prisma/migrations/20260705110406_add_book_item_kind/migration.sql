-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'book';

-- CreateTable
CREATE TABLE "item_book_details" (
    "item_id" UUID NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publisher" TEXT,
    "published_at" TIMESTAMP(3),
    "isbn" TEXT,
    "page_count" INTEGER,
    "domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_book_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_book_details" ADD CONSTRAINT "item_book_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
