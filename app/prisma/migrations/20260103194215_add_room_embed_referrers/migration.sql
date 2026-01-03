-- CreateTable
CREATE TABLE "room_embed_referrers" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "referrer_url" TEXT NOT NULL,
    "referrer_domain" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "view_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "room_embed_referrers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_embed_referrers_room_id_last_seen_at_idx" ON "room_embed_referrers"("room_id", "last_seen_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "room_embed_referrers_room_id_referrer_url_key" ON "room_embed_referrers"("room_id", "referrer_url");

-- AddForeignKey
ALTER TABLE "room_embed_referrers" ADD CONSTRAINT "room_embed_referrers_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
