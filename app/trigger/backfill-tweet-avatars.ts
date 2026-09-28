/**
 * One-time backfill: re-host tweet author avatars that are still hotlinked to
 * pbs.twimg.com, so they survive twimg URL rotation and tweet deletion. The
 * image-rehosting feature (and its backfill) covered tweet media and link-card
 * images but never the author avatar, so existing tweets show a broken avatar
 * once the twimg URL rots.
 *
 * Re-hosts straight from the `authorAvatarUrl` already stored on each tweet — it
 * does NOT re-fetch from X, so it works even for since-deleted tweets as long as
 * the CDN URL still resolves. Idempotent (skips tweets that already have an
 * `authorAvatarFileKey`), so it's safe to re-run. Touches only the avatar column
 * — media, card, cover and storage accounting are left untouched. Trigger
 * manually from the Trigger.dev dashboard; run it once, soon — the longer we
 * wait, the more source URLs rot.
 */

import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import { tweetAvatarBackfillCandidateWhere } from "../src/lib/items/tweet-avatar-backfill";
import { downloadAndStoreImage } from "../src/lib/media/rehost-image";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for backfill-tweet-avatars",
    );
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY for backfill-tweet-avatars",
    );
  }
  return { url, key };
}

const BATCH_SIZE = 500;

/**
 * Orchestrator: find every tweet with a hotlinked avatar and fan out one worker
 * per tweet (batched to stay within the batchTrigger limit).
 */
export const backfillTweetAvatarsTask = task({
  id: "backfill-tweet-avatars",
  retry: { maxAttempts: 1 },
  maxDuration: 300,
  run: async () => {
    const items = await db.item.findMany({
      where: tweetAvatarBackfillCandidateWhere(),
      select: { id: true, userId: true },
    });

    logger.info(`Found ${items.length} tweet avatars to backfill`);
    if (items.length === 0) return { success: true, total: 0, triggered: 0 };

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      await tasks.batchTrigger<typeof backfillTweetAvatarItemTask>(
        "backfill-tweet-avatar-item",
        chunk.map((it) => ({ payload: { itemId: it.id, userId: it.userId } })),
      );
      logger.info(
        `Triggered batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} avatars`,
      );
    }

    return { success: true, total: items.length, triggered: items.length };
  },
});

/**
 * Worker: re-host one tweet's author avatar. Downloads from the stored twimg URL
 * and writes only `authorAvatarFileKey` — never media, card, cover or storage
 * accounting (an avatar is never a cover, so it carries no `coverSize`).
 */
export const backfillTweetAvatarItemTask = task({
  id: "backfill-tweet-avatar-item",
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

    const details = await db.itemTwitterDetails.findUnique({
      where: { itemId },
      select: { authorAvatarUrl: true, authorAvatarFileKey: true },
    });

    if (!details?.authorAvatarUrl) {
      logger.warn("No avatar URL to backfill", { itemId });
      return { success: true, hosted: false, skipped: "no-avatar-url" };
    }
    // Already re-hosted — keeps re-runs safe.
    if (details.authorAvatarFileKey) {
      logger.info("Tweet avatar already re-hosted, skipping", { itemId });
      return { success: true, hosted: false, skipped: "already-hosted" };
    }

    const stored = await downloadAndStoreImage(
      details.authorAvatarUrl,
      userId,
      supabase,
    );
    if (!stored) {
      // Source URL has rotted away; leave the avatar hotlinked. No blob was
      // uploaded, so there's nothing to clean up.
      logger.warn("Could not re-host tweet avatar", { itemId });
      return { success: true, hosted: false, skipped: "download-failed" };
    }

    let claimed: number;
    try {
      // Compare-and-set: only claim if the row still wants exactly this avatar
      // and has no key yet. A concurrent capture/reanalysis (or overlapping
      // backfill) that set a newer key — or changed the avatar URL — wins, and
      // our now-stale upload is dropped rather than clobbering theirs.
      const result = await db.itemTwitterDetails.updateMany({
        where: {
          itemId,
          authorAvatarUrl: details.authorAvatarUrl,
          authorAvatarFileKey: null,
        },
        data: { authorAvatarFileKey: stored.fileKey },
      });
      claimed = result.count;
    } catch (error) {
      // The avatar was uploaded before this update; a failed write orphans it.
      // Delete it so retries don't accumulate orphans. Best-effort.
      await supabase.storage.from("items").remove([stored.fileKey]);
      throw error;
    }

    if (claimed === 0) {
      // Another writer got there first; our upload is unreferenced — drop it.
      await supabase.storage.from("items").remove([stored.fileKey]);
      logger.info("Tweet avatar superseded by a concurrent write, skipping", {
        itemId,
      });
      return { success: true, hosted: false, skipped: "superseded" };
    }

    logger.info("Backfilled tweet avatar", { itemId });
    return { success: true, hosted: true };
  },
});
