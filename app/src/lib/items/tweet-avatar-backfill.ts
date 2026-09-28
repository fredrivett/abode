import type { Prisma } from "@prisma/client";

/**
 * Tweets eligible for the author-avatar backfill: any tweet that still hotlinks
 * its avatar (`authorAvatarFileKey` null) but has an avatar URL to re-host. This
 * covers both pre-rehost tweets and tweets captured after image re-hosting but
 * before avatars were re-hosted — the avatar was never persisted for either.
 * Idempotent (a re-hosted avatar sets `authorAvatarFileKey`, dropping the tweet
 * from this set), so it's safe to re-run.
 */
export function tweetAvatarBackfillCandidateWhere(): Prisma.ItemWhereInput {
  return {
    kind: "twitter",
    twitterDetails: {
      authorAvatarFileKey: null,
      authorAvatarUrl: { not: null },
    },
  };
}
