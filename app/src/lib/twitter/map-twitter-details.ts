import type { Prisma } from "@prisma/client";
import type { TwitterDetails, TwitterMedia } from "@/components/twitter/types";
import {
  parseQuotedTweet,
  parseTweetPoll,
  toReplyContext,
} from "./tweet-context";

/** The `item_twitter_details` columns every tweet renderer reads */
export const twitterDetailsSelect = {
  tweetId: true,
  authorName: true,
  authorUsername: true,
  authorAvatarUrl: true,
  authorAvatarFileKey: true,
  text: true,
  isTruncated: true,
  postedAt: true,
  media: true,
  quotedTweetId: true,
  quotedTweet: true,
  card: true,
  poll: true,
  coverMediaIndex: true,
  inReplyToTweetId: true,
  inReplyToAuthorUsername: true,
  inReplyToAuthorName: true,
  inReplyToText: true,
} satisfies Prisma.ItemTwitterDetailsSelect;

export type TwitterDetailsRow = Prisma.ItemTwitterDetailsGetPayload<{
  select: typeof twitterDetailsSelect;
}>;

/** A selected row → the shape the tweet components render */
export function mapTwitterDetails(row: TwitterDetailsRow): TwitterDetails {
  return {
    tweetId: row.tweetId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl,
    authorAvatarFileKey: row.authorAvatarFileKey,
    text: row.text,
    isTruncated: row.isTruncated,
    postedAt: row.postedAt?.toISOString() ?? null,
    media: row.media as TwitterMedia[] | null,
    quotedTweetId: row.quotedTweetId,
    quotedTweet: parseQuotedTweet(row.quotedTweet),
    card: row.card as TwitterDetails["card"],
    poll: parseTweetPoll(row.poll),
    inReplyTo: toReplyContext(row),
    coverMediaIndex: row.coverMediaIndex,
  };
}
