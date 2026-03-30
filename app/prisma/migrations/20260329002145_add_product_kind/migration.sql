-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'product';

-- CreateTable
CREATE TABLE "item_product_details" (
    "item_id" UUID NOT NULL,
    "domain" TEXT,
    "brand" TEXT,
    "price" TEXT,
    "currency" TEXT,
    "availability" TEXT,
    "images" JSONB,
    "cover_image_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_product_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_product_details" ADD CONSTRAINT "item_product_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
