/**
 * One-time backfill: re-host the images of tweets captured before re-hosting
 * existed, so their photos/posters/card images survive twimg URL rotation and
 * tweet deletion.
 *
 * Re-hosts straight from the twimg URLs already stored on each tweet — it does
 * NOT re-fetch from X, so it works even for since-deleted tweets as long as the
 * CDN URL still resolves. Idempotent (skips tweets that already have a
 * coverFileKey), so it's safe to re-run. Trigger manually from the Trigger.dev
 * dashboard; run it once, soon — the longer we wait, the more source URLs rot.
 */

import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import { tweetBackfillCandidateWhere } from "../src/lib/items/tweet-backfill";
import type { TwitterDetails, TwitterMedia } from "../src/lib/types/item";
import {
  downloadAndStoreImage,
  rehostTwitterImages,
} from "./handle-twitter-url";
import {
  deleteReplacedFiles,
  reclaimReplacedStorage,
} from "./reclaim-item-storage";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for backfill-tweet-images",
    );
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY for backfill-tweet-images",
    );
  }
  return { url, key };
}

const BATCH_SIZE = 500;

/**
 * Orchestrator: find every tweet needing a backfill and fan out one worker per
 * tweet (batched to stay within the batchTrigger limit).
 */
export const backfillTweetImagesTask = task({
  id: "backfill-tweet-images",
  retry: { maxAttempts: 1 },
  maxDuration: 300,
  run: async () => {
    const items = await db.item.findMany({
      where: tweetBackfillCandidateWhere(),
      select: { id: true, userId: true },
    });

    logger.info(`Found ${items.length} tweets to backfill`);
    if (items.length === 0) return { success: true, total: 0, triggered: 0 };

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      await tasks.batchTrigger<typeof backfillTweetImageItemTask>(
        "backfill-tweet-image-item",
        chunk.map((it) => ({ payload: { itemId: it.id, userId: it.userId } })),
      );
      logger.info(
        `Triggered batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} tweets`,
      );
    }

    return { success: true, total: items.length, triggered: items.length };
  },
});

/**
 * Worker: re-host one tweet's images. Mirrors the capture path's persist step
 * (reclaim → write keys → clean up) but touches only the image fields — kind,
 * title, description, tags and enrichment are already correct.
 */
export const backfillTweetImageItemTask = task({
  id: "backfill-tweet-image-item",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
  },
  maxDuration: 120,
  run: async (payload: { itemId: string; userId: string }) => {
    const { itemId, userId } = payload;
    const { url, key } = getSupabaseConfig();
    const supabase = createClient(url, key);

    const item = await db.item.findUnique({
      where: { id: itemId, userId },
      select: {
        coverFileKey: true,
        twitterDetails: {
          select: { media: true, card: true, coverMediaIndex: true },
        },
      },
    });

    if (!item?.twitterDetails) {
      logger.warn("No twitter details to backfill", { itemId });
      return { success: true, hosted: 0, skipped: "no-details" };
    }
    // A set coverFileKey means images are already re-hosted — keeps re-runs safe.
    if (item.coverFileKey) {
      logger.info("Tweet already has re-hosted images, skipping", { itemId });
      return { success: true, hosted: 0, skipped: "already-hosted" };
    }

    const details = {
      media: item.twitterDetails.media as TwitterMedia[] | null,
      card: item.twitterDetails.card as TwitterDetails["card"],
      coverMediaIndex: item.twitterDetails.coverMediaIndex,
    };

    const rehosted = await rehostTwitterImages(details, (imageUrl) =>
      downloadAndStoreImage(imageUrl, userId, supabase),
    );

    if (!rehosted.coverFileKey) {
      // Nothing hostable, or every source URL has already rotted away.
      logger.warn("No tweet images could be re-hosted", { itemId });
      return { success: true, hosted: 0, skipped: "nothing-hosted" };
    }

    let replacedFileKeys: string[];
    try {
      replacedFileKeys = await db.$transaction(async (tx) => {
        // Cover-only accounting, matching the capture path.
        const oldFileKeys = await reclaimReplacedStorage(tx, {
          itemId,
          userId,
          addedBytes: rehosted.coverSize,
        });

        await tx.item.update({
          where: { id: itemId, userId },
          data: {
            coverFileKey: rehosted.coverFileKey,
            meta:
              rehosted.coverSize > 0
                ? { coverSize: rehosted.coverSize }
                : Prisma.JsonNull,
          },
        });

        await tx.itemTwitterDetails.update({
          where: { itemId },
          data: {
            media: (rehosted.media as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            card: (rehosted.card as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        });

        return oldFileKeys;
      });
    } catch (error) {
      // Uploads happened before the transaction; a failed commit orphans them.
      // Delete them so retries don't accumulate orphans. Best-effort; only safe
      // because the commit didn't happen.
      await deleteReplacedFiles(supabase, rehosted.storedFileKeys, []);
      throw error;
    }

    await deleteReplacedFiles(
      supabase,
      replacedFileKeys,
      rehosted.storedFileKeys,
    );

    logger.info("Backfilled tweet images", {
      itemId,
      hosted: rehosted.storedFileKeys.length,
    });
    return { success: true, hosted: rehosted.storedFileKeys.length };
  },
});
