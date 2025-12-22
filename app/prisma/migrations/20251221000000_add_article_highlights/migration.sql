-- CreateTable
CREATE TABLE "article_highlights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_highlights_item_id_idx" ON "article_highlights"("item_id");

-- CreateIndex
CREATE INDEX "article_highlights_user_id_idx" ON "article_highlights"("user_id");

-- AddForeignKey
ALTER TABLE "article_highlights" ADD CONSTRAINT "article_highlights_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_highlights" ADD CONSTRAINT "article_highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
