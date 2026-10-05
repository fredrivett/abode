import type { Prisma } from "@prisma/client";
import type { fetchTweet } from "react-tweet/api";
import db from "@/lib/db";
import {
  type RawTweet,
  transformTweetData,
  tweetDescriptionSource,
  tweetItemTitle,
} from "@/lib/twitter/transform-tweet";
import { tweetContextData } from "@/lib/twitter/tweet-context-data";

/**
 * Every saved tweet: tweets captured before tweet context existed carry the raw
 * text and no truncation flag, quote, poll, reply context or Article card, and
 * there's no column that tells them apart from a tweet that simply has none.
 * Re-running is safe — it re-derives the same values.
 */
export function tweetContextBackfillCandidateWhere(): Prisma.ItemWhereInput {
  return { kind: "twitter", twitterDetails: { isNot: null } };
}

export type TweetContextRefreshResult =
  | { refreshed: true; article: boolean }
  | { refreshed: false; skipped: "no-details" | "unavailable" | "superseded" };

/**
 * Re-fetch one saved tweet from X's embed endpoint and fill in its context
 * columns. Media, avatar and an existing card are left alone — they carry
 * re-hosted storage keys. A tweet that's become an Article card gets its
 * (hotlinked) card plus the Article's title and description; the
 * `backfill-tweet-images` task re-hosts the cover afterwards.
 */
export async function refreshTweetContext({
  itemId,
  fetch,
}: {
  itemId: string;
  fetch: typeof fetchTweet;
}): Promise<TweetContextRefreshResult> {
  const existing = await db.itemTwitterDetails.findUnique({
    where: { itemId },
    select: { tweetId: true, card: true },
  });
  if (!existing) return { refreshed: false, skipped: "no-details" };

  const result = await fetch(existing.tweetId);
  // Deleted, hidden or not served: keep what was captured
  if (!result.data) return { refreshed: false, skipped: "unavailable" };

  const tweet: RawTweet = result.data;
  const details = transformTweetData(tweet);
  const addArticleCard =
    existing.card === null && details.card?.type === "article";

  const claimed = await db.$transaction(async (tx) => {
    // Compare-and-set on tweetId: if the item was re-captured as a different
    // tweet meanwhile, its newer row wins
    const { count } = await tx.itemTwitterDetails.updateMany({
      where: { itemId, tweetId: existing.tweetId },
      data: {
        ...tweetContextData(details),
        ...(addArticleCard && { card: details.card ?? undefined }),
      },
    });
    if (count === 0) return false;
    if (addArticleCard) {
      await tx.item.update({
        where: { id: itemId },
        data: {
          title: tweetItemTitle(details),
          description: tweetDescriptionSource(details)?.slice(0, 200) ?? null,
        },
      });
    }
    return true;
  });

  if (!claimed) return { refreshed: false, skipped: "superseded" };
  return { refreshed: true, article: addArticleCard };
}
