-- AlterTable
ALTER TABLE "item_twitter_details" ADD COLUMN     "in_reply_to_author_name" TEXT,
ADD COLUMN     "in_reply_to_author_username" TEXT,
ADD COLUMN     "in_reply_to_text" TEXT,
ADD COLUMN     "in_reply_to_tweet_id" TEXT,
ADD COLUMN     "is_truncated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "poll" JSONB,
ADD COLUMN     "quoted_tweet" JSONB;
