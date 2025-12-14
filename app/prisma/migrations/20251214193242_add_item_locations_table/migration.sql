-- DropIndex
DROP INDEX "item_text_vectors_embedding_idx";

-- DropIndex
DROP INDEX "item_visual_vectors_embedding_idx";

-- CreateTable
CREATE TABLE "item_locations" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "provider" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "formatted" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_locations_user_id_city_idx" ON "item_locations"("user_id", "city");

-- CreateIndex
CREATE INDEX "item_locations_user_id_country_idx" ON "item_locations"("user_id", "country");

-- CreateIndex
CREATE INDEX "item_locations_user_id_country_code_idx" ON "item_locations"("user_id", "country_code");

-- CreateIndex
CREATE UNIQUE INDEX "item_locations_item_id_source_key" ON "item_locations"("item_id", "source");

-- AddForeignKey
ALTER TABLE "item_locations" ADD CONSTRAINT "item_locations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_locations" ADD CONSTRAINT "item_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
