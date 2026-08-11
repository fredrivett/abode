import type { analyzeImageTask } from "@app/trigger/analyze-image";
import type { backfillBlurPlaceholdersTask } from "@app/trigger/backfill-blur-placeholders";
import type { classifyUrlTask } from "@app/trigger/classify-url";
import type { Prisma } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import { env } from "@/env.server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { batchIdempotencyKey } from "./batch-idempotency-key";
import { type IssueSpec, issueSpecs } from "./processing-issues";

const log = createLogger("admin/reprocess-issues");

/** Max items reprocessed per click — keeps backlog + cost bounded. */
export const REPROCESS_LIMIT = 50;

/**
 * De-dupe window for a per-item reprocess. Roughly the drain time of a full
 * batch at concurrency 2, so a concurrent or rapid re-click of the same card
 * won't enqueue a second paid run for an item whose first run is still in
 * flight. Long enough to matter, short enough that a genuine later re-run works.
 */
const REPROCESS_IDEMPOTENCY_TTL = "15m";

/** All reprocess runs carry this tag so they're filterable in the dashboard. */
const REPROCESS_TAG = "admin-reprocess";

/**
 * A Trigger dashboard link filtered to this run's reprocess tag, or null when
 * `TRIGGER_RUNS_DASHBOARD_URL` isn't set. The base URL (which carries the private
 * org/project/env slugs) is config, not code — see env.server.ts.
 */
function monitorUrl(): string | null {
  const base = env.TRIGGER_RUNS_DASHBOARD_URL;
  if (!base) return null;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}tags=${REPROCESS_TAG}&period=1d&rootOnly=false`;
}

/**
 * Only items that actually have a capture pipeline can be reprocessed.
 * `{ gt: "" }` requires a present, non-empty value (excludes both null and ""),
 * so we never enqueue a run with empty input — matching the retry route's
 * truthiness guard.
 */
const REPROCESSABLE: Prisma.ItemWhereInput = {
  OR: [
    { sourceType: "url", sourceUrl: { gt: "" } },
    // Non-URL image uploads (incl. null source — the retry route analyses any
    // `kind=image` with a fileKey regardless of source). URL-sourced images go
    // to classify-url above, which re-hosts + enqueues analyze-image itself, so
    // they must not also be routed here or one item gets two paid pipelines.
    {
      OR: [{ sourceType: { not: "url" } }, { sourceType: null }],
      kind: "image",
      fileKey: { gt: "" },
    },
  ],
};

/**
 * A blur heal needs a resolvable source image on the item row — its own upload
 * (`fileKey`) or a cached cover (`coverFileKey`). `{ gt: "" }` excludes null and
 * "" so we never hand the heal task an item it can only skip (keeps the reported
 * count honest). Mirrors the COALESCE(file_key, cover_file_key) the heal reads.
 */
const HAS_IMAGE_SOURCE: Prisma.ItemWhereInput = {
  OR: [{ fileKey: { gt: "" } }, { coverFileKey: { gt: "" } }],
};

export type ReprocessResult = {
  triggered: number;
  /** Trigger dashboard link (filtered to reprocess runs) for monitoring. */
  monitorUrl: string | null;
};

/**
 * Regenerate only the LQIP blur placeholder for a group's current members
 * (capped, newest-first). The blur is a pure decode-time artifact, so this
 * scopes the existing `backfill-blur-placeholders` task (sharp, no AI) to this
 * batch instead of re-running the paid capture pipeline. These are completed
 * items with a `null` blur — never flipped to `processing`, so a heal can't
 * downgrade a healthy item. One background run sweeps the batch (a free/fast op
 * that shouldn't compete for the paid image queue), tagged for monitoring.
 */
async function reprocessBlurGroup(spec: IssueSpec): Promise<ReprocessResult> {
  const items = await db.item.findMany({
    where: { AND: [spec.where, HAS_IMAGE_SOURCE] },
    orderBy: { updatedAt: "desc" },
    take: REPROCESS_LIMIT,
    select: { id: true },
  });
  if (items.length === 0) return { triggered: 0, monitorUrl: null };

  const itemIds = items.map((i) => i.id);

  try {
    await tasks.trigger<typeof backfillBlurPlaceholdersTask>(
      "backfill-blur-placeholders",
      { itemIds },
      {
        tags: [REPROCESS_TAG],
        // Dedupes a rapid re-click of the same unhealed batch within the TTL.
        idempotencyKey: batchIdempotencyKey("reprocess:blur", itemIds),
        idempotencyKeyTTL: REPROCESS_IDEMPOTENCY_TTL,
      },
    );
  } catch (error) {
    log.error(
      { error, count: itemIds.length },
      "backfill-blur-placeholders trigger failed",
    );
    captureServerException(error, undefined, {
      route: "reprocessIssueGroup",
      stage: "trigger:backfill-blur-placeholders",
      count: itemIds.length,
    });
    throw new Error(`Failed to enqueue blur heal for ${itemIds.length} items`);
  }

  return { triggered: itemIds.length, monitorUrl: monitorUrl() };
}

/**
 * Re-run the capture pipeline for the current members of an issue group (capped,
 * newest-first). Re-derives the set from the SAME predicate that defines the
 * group (single source of truth), intersected with {@link REPROCESSABLE} so the
 * cap advances past non-actionable rows (e.g. notes) rather than stalling on
 * them.
 *
 * Groups whose gap is a cheap derived artifact (e.g. the blur placeholder) route
 * to a targeted local heal instead — see {@link reprocessBlurGroup}. Everything
 * else routes each item to its capture task like the retry route (`classify-url`
 * for URLs, `analyze-image` for image uploads, URL taking precedence). Reuses
 * those tasks so every guardrail — the shared concurrency-2 queue, per-user
 * `concurrencyKey`, `markProcessingActive` — applies automatically, and carries
 * a per-item idempotency key so a double-click can't double-charge. Runs are
 * tagged `admin-reprocess` for dashboard monitoring.
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

  // Cheap targeted heals bypass the paid pipeline entirely.
  if (spec.repair === "blur") return reprocessBlurGroup(spec);

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
  if (items.length === 0) return { triggered: 0, monitorUrl: null };

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
    idempotencyKey: `reprocess:${itemId}`,
    idempotencyKeyTTL: REPROCESS_IDEMPOTENCY_TTL,
    tags: [REPROCESS_TAG],
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
      captureServerException(error, undefined, {
        route: "reprocessIssueGroup",
        stage: "trigger:classify-url",
        count: urlItems.length,
      });
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
      captureServerException(error, undefined, {
        route: "reprocessIssueGroup",
        stage: "trigger:analyze-image",
        count: imageItems.length,
      });
      failedIds.push(...imageItems.map((i) => i.id));
    }
  }

  // Don't strand claimed error items in `processing` with no run — restore them
  // so they resurface in the card and stay retryable. (Completed items were
  // never flipped, so nothing to restore.)
  if (isError && failedIds.length > 0) {
    await db.item.updateMany({
      where: { id: { in: failedIds } },
      // Stamp the reason so a failed enqueue reads as `enqueue_failed`, not a
      // bare "unknown" (mirrors createItemFromUrl and the retry route).
      data: { processingStatus: "failed", processingError: "enqueue_failed" },
    });
  }

  if (failedIds.length > 0) {
    throw new Error(
      `Failed to enqueue ${failedIds.length} of ${targetIds.length} reprocess runs`,
    );
  }

  return { triggered: targetIds.length, monitorUrl: monitorUrl() };
}
