-- AlterEnum
ALTER TYPE "ItemKind" ADD VALUE 'twitter';

-- CreateTable
CREATE TABLE "item_twitter_details" (
    "item_id" UUID NOT NULL,
    "tweet_id" TEXT NOT NULL,
    "author_name" TEXT,
    "author_username" TEXT NOT NULL,
    "author_avatar_url" TEXT,
    "text" TEXT,
    "posted_at" TIMESTAMP(3),
    "media" JSONB,
    "quoted_tweet_id" TEXT,
    "card" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_twitter_details_pkey" PRIMARY KEY ("item_id")
);

-- AddForeignKey
ALTER TABLE "item_twitter_details" ADD CONSTRAINT "item_twitter_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
