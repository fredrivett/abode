-- CreateEnum
CREATE TYPE "VectorKind" AS ENUM ('visual', 'text');

-- CreateTable
CREATE TABLE "item_vectors" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "VectorKind" NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_vectors_item_id_idx" ON "item_vectors"("item_id");

-- CreateIndex
CREATE INDEX "item_vectors_user_id_kind_idx" ON "item_vectors"("user_id", "kind");

-- AddForeignKey
ALTER TABLE "item_vectors" ADD CONSTRAINT "item_vectors_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_vectors" ADD CONSTRAINT "item_vectors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
