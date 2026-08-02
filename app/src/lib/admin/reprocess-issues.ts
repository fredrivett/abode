import type { analyzeImageTask } from "@app/trigger/analyze-image";
import type { classifyUrlTask } from "@app/trigger/classify-url";
import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { issueSpecs } from "./processing-issues";

/** Max items reprocessed per click — keeps backlog + cost bounded. */
export const REPROCESS_LIMIT = 50;

/**
 * Run reprocessing below live captures. Trigger priority is relative (higher =
 * sooner, default 0), so a large negative value means a fresh user upload
 * (priority 0) always preempts queued reprocess runs on the shared
 * `image-analysis` queue.
 */
const REPROCESS_PRIORITY = -3600;

export type ReprocessResult = { triggered: number; skipped: number };

/**
 * Re-run the capture pipeline for the current members of an issue group (capped,
 * newest-first). Re-derives the set from the SAME predicate that defines the
 * group (single source of truth), so there are no stale client-passed ids.
 *
 * Routes each item to its capture task exactly like the retry route
 * (`classify-url` for URLs, `analyze-image` for image uploads); anything else
 * (e.g. notes) has no pipeline and is skipped. Reuses those tasks so every
 * guardrail — the shared concurrency-2 queue, per-user `concurrencyKey`,
 * `markProcessingActive` — applies automatically. Runs at a low priority so it
 * yields to live uploads.
 *
 * Error groups (failed/stuck) are a fresh attempt → flip to `processing` and
 * reset the reaper clock. Completed items are re-analysed silently in place, so
 * a failed re-run can never downgrade a healthy item to `failed`.
 */
export async function reprocessIssueGroup(
  groupKey: string,
): Promise<ReprocessResult> {
  const spec = issueSpecs().find((s) => s.key === groupKey);
  if (!spec) throw new Error(`Unknown issue group: ${groupKey}`);

  const items = await db.item.findMany({
    where: spec.where,
    orderBy: { updatedAt: "desc" },
    take: REPROCESS_LIMIT,
    select: {
      id: true,
      userId: true,
      kind: true,
      sourceType: true,
      sourceUrl: true,
      fileKey: true,
    },
  });

  const urlItems = items.filter(
    (i): i is typeof i & { sourceUrl: string } =>
      i.sourceType === "url" && Boolean(i.sourceUrl),
  );
  const imageItems = items.filter(
    (i): i is typeof i & { fileKey: string } =>
      i.kind === "image" && Boolean(i.fileKey),
  );
  const targetIds = [...urlItems, ...imageItems].map((i) => i.id);
  const skipped = items.length - targetIds.length;

  if (targetIds.length === 0) return { triggered: 0, skipped };

  if (spec.severity === "error") {
    await db.item.updateMany({
      where: { id: { in: targetIds } },
      data: {
        processingStatus: "processing",
        processingError: null,
        processingStartedAt: new Date(),
      },
    });
  }

  const options = (userId: string) => ({
    concurrencyKey: userId,
    priority: REPROCESS_PRIORITY,
  });

  if (urlItems.length > 0) {
    await tasks.batchTrigger<typeof classifyUrlTask>(
      "classify-url",
      urlItems.map((i) => ({
        payload: { itemId: i.id, userId: i.userId, url: i.sourceUrl },
        options: options(i.userId),
      })),
    );
  }
  if (imageItems.length > 0) {
    await tasks.batchTrigger<typeof analyzeImageTask>(
      "analyze-image",
      imageItems.map((i) => ({
        payload: { itemId: i.id, userId: i.userId, fileKey: i.fileKey },
        options: options(i.userId),
      })),
    );
  }

  return { triggered: targetIds.length, skipped };
}
