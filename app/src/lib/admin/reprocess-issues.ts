import type { analyzeImageTask } from "@app/trigger/analyze-image";
import type { classifyUrlTask } from "@app/trigger/classify-url";
import type { Prisma } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { issueSpecs } from "./processing-issues";

const log = createLogger("admin/reprocess-issues");

/** Max items reprocessed per click — keeps backlog + cost bounded. */
export const REPROCESS_LIMIT = 50;

/**
 * Run reprocessing below live captures. Trigger priority is relative (higher =
 * sooner, default 0), so a large negative value means a fresh user upload
 * (priority 0) always preempts queued reprocess runs on the shared
 * `image-analysis` queue.
 */
const REPROCESS_PRIORITY = -3600;

/**
 * De-dupe window for a per-item reprocess. Roughly the drain time of a full
 * batch at concurrency 2, so a concurrent or rapid re-click of the same card
 * won't enqueue a second paid run for an item whose first run is still in
 * flight. Long enough to matter, short enough that a genuine later re-run works.
 */
const REPROCESS_IDEMPOTENCY_TTL = "15m";

/**
 * Only items that actually have a capture pipeline can be reprocessed.
 * `{ gt: "" }` requires a present, non-empty value (excludes both null and ""),
 * so we never enqueue a run with empty input — matching the retry route's
 * truthiness guard.
 */
const REPROCESSABLE: Prisma.ItemWhereInput = {
  OR: [
    { sourceType: "url", sourceUrl: { gt: "" } },
    // Non-URL image uploads. URL-sourced images go to classify-url (above),
    // which re-hosts + enqueues analyze-image itself — so they must not also be
    // routed here, or one item gets two paid pipelines.
    { NOT: { sourceType: "url" }, kind: "image", fileKey: { gt: "" } },
  ],
};

export type ReprocessResult = { triggered: number };

/**
 * Re-run the capture pipeline for the current members of an issue group (capped,
 * newest-first). Re-derives the set from the SAME predicate that defines the
 * group (single source of truth), intersected with {@link REPROCESSABLE} so the
 * cap advances past non-actionable rows (e.g. notes) rather than stalling on
 * them.
 *
 * Routes each item to its capture task like the retry route (`classify-url` for
 * URLs, `analyze-image` for image uploads, URL taking precedence). Reuses those
 * tasks so every guardrail — the shared concurrency-2 queue, per-user
 * `concurrencyKey`, `markProcessingActive` — applies automatically. Runs at low
 * priority (yields to live uploads) and carries a per-item idempotency key so a
 * double-click can't double-charge.
 *
 * Error groups (failed/stuck) are a fresh attempt → flip to `processing` and
 * reset the reaper clock. Completed items are re-analysed silently in place, so
 * a failed re-run can never downgrade a healthy item to `failed`. If a Trigger
 * enqueue fails, the affected error items are restored to `failed` so they stay
 * visible + retryable rather than stranded in `processing` until the reaper.
 */
export async function reprocessIssueGroup(
  groupKey: string,
): Promise<ReprocessResult> {
  const spec = issueSpecs().find((s) => s.key === groupKey);
  if (!spec) throw new Error(`Unknown issue group: ${groupKey}`);

  const items = await db.item.findMany({
    where: { AND: [spec.where, REPROCESSABLE] },
    orderBy: { updatedAt: "desc" },
    take: REPROCESS_LIMIT,
    select: {
      id: true,
      userId: true,
      sourceType: true,
      sourceUrl: true,
      fileKey: true,
    },
  });
  if (items.length === 0) return { triggered: 0 };

  // Mutually exclusive by construction of REPROCESSABLE: URL items (incl.
  // URL-sourced images) → classify-url; everything else is a non-URL image.
  const urlItems = items.filter((i) => i.sourceType === "url");
  const imageItems = items.filter((i) => i.sourceType !== "url");
  const targetIds = items.map((i) => i.id);
  const isError = spec.severity === "error";

  if (isError) {
    await db.item.updateMany({
      where: { id: { in: targetIds } },
      data: {
        processingStatus: "processing",
        processingError: null,
        processingStartedAt: new Date(),
      },
    });
  }

  const triggerOptions = (userId: string, itemId: string) => ({
    concurrencyKey: userId,
    priority: REPROCESS_PRIORITY,
    idempotencyKey: `reprocess:${itemId}`,
    idempotencyKeyTTL: REPROCESS_IDEMPOTENCY_TTL,
  });

  const failedIds: string[] = [];

  if (urlItems.length > 0) {
    try {
      await tasks.batchTrigger<typeof classifyUrlTask>(
        "classify-url",
        urlItems.map((i) => ({
          payload: { itemId: i.id, userId: i.userId, url: i.sourceUrl ?? "" },
          options: triggerOptions(i.userId, i.id),
        })),
      );
    } catch (error) {
      log.error({ error, count: urlItems.length }, "classify-url batch failed");
      failedIds.push(...urlItems.map((i) => i.id));
    }
  }

  if (imageItems.length > 0) {
    try {
      await tasks.batchTrigger<typeof analyzeImageTask>(
        "analyze-image",
        imageItems.map((i) => ({
          payload: { itemId: i.id, userId: i.userId, fileKey: i.fileKey ?? "" },
          options: triggerOptions(i.userId, i.id),
        })),
      );
    } catch (error) {
      log.error(
        { error, count: imageItems.length },
        "analyze-image batch failed",
      );
      failedIds.push(...imageItems.map((i) => i.id));
    }
  }

  // Don't strand claimed error items in `processing` with no run — restore them
  // so they resurface in the card and stay retryable. (Completed items were
  // never flipped, so nothing to restore.)
  if (isError && failedIds.length > 0) {
    await db.item.updateMany({
      where: { id: { in: failedIds } },
      data: { processingStatus: "failed" },
    });
  }

  if (failedIds.length > 0) {
    throw new Error(
      `Failed to enqueue ${failedIds.length} of ${targetIds.length} reprocess runs`,
    );
  }

  return { triggered: targetIds.length };
}
