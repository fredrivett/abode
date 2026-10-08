import { Prisma } from "@prisma/client";
import type { TwitterDetails } from "@/components/twitter/types";

/**
 * The `item_twitter_details` columns re-derived from X's embed data on every
 * fetch: the text and everything shown around it (truncation, quote, poll,
 * reply context). Shared by capture and the tweet-context backfill so both
 * write identical rows. Media, card and avatar are left out — they carry
 * re-hosted storage keys, which only capture and the image backfills manage.
 */
export function tweetContextData(
  details: Pick<
    TwitterDetails,
    | "text"
    | "isTruncated"
    | "quotedTweetId"
    | "quotedTweet"
    | "poll"
    | "inReplyTo"
  >,
) {
  return {
    text: details.text,
    isTruncated: details.isTruncated,
    quotedTweetId: details.quotedTweetId,
    quotedTweet: details.quotedTweet ?? Prisma.JsonNull,
    poll: details.poll ?? Prisma.JsonNull,
    inReplyToTweetId: details.inReplyTo?.tweetId ?? null,
    inReplyToAuthorUsername: details.inReplyTo?.authorUsername ?? null,
    inReplyToAuthorName: details.inReplyTo?.authorName ?? null,
    inReplyToText: details.inReplyTo?.text ?? null,
  } satisfies Prisma.ItemTwitterDetailsUpdateInput;
}
