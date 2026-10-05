import { z } from "zod";

/**
 * Shapes of the JSON tweet-context columns on `item_twitter_details`
 * (`quoted_tweet`, `poll`). JSON has no shape in the database, so these schemas
 * are the source of truth: capture validates before writing, and every read
 * goes through `parseQuotedTweet` / `parseTweetPoll`, so a row that doesn't
 * match renders as absent rather than crashing the card.
 */

const twitterMediaSchema = z.object({
  type: z.enum(["photo", "video", "animated_gif"]),
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  posterUrl: z.string().optional(),
});

export const quotedTweetSchema = z.object({
  tweetId: z.string(),
  authorName: z.string().nullable(),
  authorUsername: z.string(),
  authorAvatarUrl: z.string().nullable(),
  text: z.string().nullable(),
  // Long-form post: `text` is only the first ~280 chars
  isTruncated: z.boolean(),
  postedAt: z.string().nullable(),
  // Hotlinked twimg stills (photos / video posters) — never re-hosted
  media: z.array(twitterMediaSchema).nullable(),
});

export type QuotedTweet = z.infer<typeof quotedTweetSchema>;

export const tweetPollSchema = z.object({
  options: z
    .array(z.object({ label: z.string(), votes: z.number().int().min(0) }))
    .min(2),
  endsAt: z.string().nullable(),
  // X stops counting once the poll closes; until then counts are a snapshot
  isFinal: z.boolean(),
});

export type TweetPoll = z.infer<typeof tweetPollSchema>;

/** The post a tweet replies to, from the flat `in_reply_to_*` columns */
export type TweetReplyContext = {
  tweetId: string;
  authorUsername: string;
  authorName: string | null;
  // Null when X didn't include the parent (e.g. it was deleted)
  text: string | null;
};

function parseJson<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseQuotedTweet(value: unknown): QuotedTweet | null {
  return parseJson(quotedTweetSchema, value);
}

export function parseTweetPoll(value: unknown): TweetPoll | null {
  return parseJson(tweetPollSchema, value);
}

/** Rebuilds the reply context from its flat columns (null when not a reply) */
export function toReplyContext(row: {
  inReplyToTweetId: string | null;
  inReplyToAuthorUsername: string | null;
  inReplyToAuthorName: string | null;
  inReplyToText: string | null;
}): TweetReplyContext | null {
  if (!row.inReplyToTweetId || !row.inReplyToAuthorUsername) return null;
  return {
    tweetId: row.inReplyToTweetId,
    authorUsername: row.inReplyToAuthorUsername,
    authorName: row.inReplyToAuthorName,
    text: row.inReplyToText,
  };
}
