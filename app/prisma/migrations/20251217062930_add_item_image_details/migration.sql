-- CreateTable
CREATE TABLE "item_image_details" (
    "item_id" UUID NOT NULL,
    "objects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" JSONB,
    "ocr_text" TEXT,
    "vision_data" JSONB,
    "capture_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_image_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_image_details" ADD CONSTRAINT "item_image_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
