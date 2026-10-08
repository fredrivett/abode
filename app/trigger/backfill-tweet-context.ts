/**
 * One-time backfill: re-fetch every saved tweet from X's embed endpoint and fill
 * in the tweet context added after it was captured — cleaned-up text, the
 * long-form truncation flag, quoted tweet, poll, reply context and X Article
 * card. Without it, older tweets keep showing t.co links and escaped `&amp;`,
 * and long posts give no hint that they're cut off.
 *
 * Touches only those columns (plus an Article's title/description) — never
 * media, avatar, an existing card, cover or storage accounting, and it doesn't
 * re-run enrichment. Tweets X no longer serves are skipped, keeping what was
 * captured. Idempotent, so safe to re-run. Trigger manually from the Trigger.dev
 * dashboard, then run `backfill-tweet-images` to re-host new Article covers.
 */

import { logger, task, tasks } from "@trigger.dev/sdk";
import { fetchTweet } from "react-tweet/api";
import db from "../src/lib/db";
import {
  refreshTweetContext,
  type TweetContextRefreshResult,
  tweetContextBackfillCandidateWhere,
} from "../src/lib/items/tweet-context-backfill";
import { captureServerException } from "../src/lib/posthog-server";

const BATCH_SIZE = 500;

/**
 * Orchestrator: find every saved tweet and fan out one worker per tweet
 * (batched to stay within the batchTrigger limit).
 */
export const backfillTweetContextTask = task({
  id: "backfill-tweet-context",
  retry: { maxAttempts: 1 },
  maxDuration: 300,
  run: async () => {
    const items = await db.item.findMany({
      where: tweetContextBackfillCandidateWhere(),
      select: { id: true },
    });

    logger.info(`Found ${items.length} tweets to refresh`);
    if (items.length === 0) return { success: true, total: 0, triggered: 0 };

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      await tasks.batchTrigger<typeof backfillTweetContextItemTask>(
        "backfill-tweet-context-item",
        chunk.map((it) => ({ payload: { itemId: it.id } })),
      );
      logger.info(
        `Triggered batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} tweets`,
      );
    }

    return { success: true, total: items.length, triggered: items.length };
  },
});

/** Worker: refresh one tweet's context columns */
export const backfillTweetContextItemTask = task({
  id: "backfill-tweet-context-item",
  // Gentle on X's embed endpoint, which rate-limits bursts
  queue: { concurrencyLimit: 5 },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
  },
  maxDuration: 60,
  run: async (payload: { itemId: string }) => {
    const { itemId } = payload;
    let result: TweetContextRefreshResult;
    try {
      result = await refreshTweetContext({ itemId, fetch: fetchTweet });
    } catch (error) {
      logger.error("Tweet context refresh failed", { itemId, error });
      captureServerException(error, undefined, {
        task: "backfill-tweet-context-item",
        itemId,
      });
      throw error;
    }

    if (result.refreshed) {
      logger.info("Refreshed tweet context", {
        itemId,
        article: result.article,
      });
    } else {
      logger.info("Skipped tweet context refresh", {
        itemId,
        reason: result.skipped,
      });
    }
    return { success: true, ...result };
  },
});
