/**
 * One-time backfill: analyse the cover image of tweets captured before cover
 * analysis existed, so their objects/OCR/colours/embedding feed search +
 * similar-images.
 *
 * Runs after the re-hosting backfill (needs `coverFileKey` set). Fans out to the
 * idempotent, cache-aware analyze-media-cover task, so it's safe to re-run —
 * tweets already analysed have a cache row and are excluded. Trigger manually
 * from the Trigger.dev dashboard.
 */

import { logger, task, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import {
  coverNeedsAnalysis,
  tweetCoverAnalysisBackfillWhere,
} from "../src/lib/items/tweet-cover-analysis-backfill";
import type { analyzeMediaCoverTask } from "./analyze-media-cover";

const BATCH_SIZE = 500;

export const backfillTweetCoverAnalysisTask = task({
  id: "backfill-tweet-cover-analysis",
  retry: { maxAttempts: 1 },
  maxDuration: 300,
  run: async () => {
    const items = await db.item.findMany({
      where: tweetCoverAnalysisBackfillWhere(),
      select: {
        id: true,
        userId: true,
        coverFileKey: true,
        twitterDetails: { select: { text: true } },
        mediaAnalyses: { select: { fileKey: true } },
      },
    });

    const batchItems = items
      // coverFileKey is non-null per the where clause; this also narrows the type
      .filter((it): it is typeof it & { coverFileKey: string } =>
        Boolean(it.coverFileKey),
      )
      // Only tweets whose *current* cover hasn't been analysed (a cache row for
      // an old cover must not exclude them)
      .filter((it) =>
        coverNeedsAnalysis(
          it.coverFileKey,
          it.mediaAnalyses.map((m) => m.fileKey),
        ),
      )
      .map((it) => ({
        payload: {
          itemId: it.id,
          userId: it.userId,
          fileKey: it.coverFileKey,
          extraSourceText: it.twitterDetails?.text ?? undefined,
        },
      }));

    logger.info(
      `Scanned ${items.length} re-hosted tweets, ${batchItems.length} need cover analysis`,
    );
    if (batchItems.length === 0) return { total: items.length, triggered: 0 };

    for (let i = 0; i < batchItems.length; i += BATCH_SIZE) {
      const chunk = batchItems.slice(i, i + BATCH_SIZE);
      await tasks.batchTrigger<typeof analyzeMediaCoverTask>(
        "analyze-media-cover",
        chunk,
      );
      logger.info(
        `Triggered batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} tweets`,
      );
    }

    return { total: items.length, triggered: batchItems.length };
  },
});
