import { Prisma } from "@prisma/client";

/**
 * Items eligible for the tweet-image backfill: tweets captured before
 * re-hosting existed (so `coverFileKey` is null) that actually have an image to
 * host — media stills or a link card. Tweets captured after the feature already
 * set `coverFileKey` when they hosted anything, so they're excluded, which makes
 * the backfill idempotent and safe to re-run. Text-only tweets (no media, no
 * card) are excluded too, so we don't fan out a no-op worker per tweet.
 */
export function tweetBackfillCandidateWhere(): Prisma.ItemWhereInput {
  return {
    kind: "twitter",
    coverFileKey: null,
    twitterDetails: {
      OR: [
        { media: { not: Prisma.AnyNull } },
        { card: { not: Prisma.AnyNull } },
      ],
    },
  };
}
