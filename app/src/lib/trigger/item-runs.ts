import { runs } from "@trigger.dev/sdk";
import { env } from "@/env.server";
import { itemTag } from "@/lib/items/run-tags";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("trigger/item-runs");

/** Most recent runs to show for an item — a debug glance, not full history. */
const MAX_ITEM_RUNS = 20;

/**
 * Whether the Trigger Management API can be called. The SDK reads
 * TRIGGER_SECRET_KEY from the environment; absent = optional integration not
 * configured, so we skip the runs list cleanly rather than erroring.
 */
export function isTriggerConfigured(): boolean {
  return Boolean(env.TRIGGER_SECRET_KEY);
}

/** A single Trigger run for an item, trimmed to what the admin table renders. */
export type ItemRun = {
  id: string;
  status: string;
  taskIdentifier: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number;
  costInCents: number;
};

export type ItemRunsResult =
  | { state: "not_configured" }
  | { state: "error" }
  | { state: "ok"; runs: ItemRun[] };

/**
 * List the most recent Trigger runs for an item, found by its `item_<id>` tag.
 * Graceful by design: unconfigured → `not_configured` (render nothing), any API
 * failure → `error` (reported, non-fatal) so the surrounding inspector never
 * breaks over an optional enhancement.
 */
export async function listItemRuns(itemId: string): Promise<ItemRunsResult> {
  if (!isTriggerConfigured()) return { state: "not_configured" };

  try {
    const page = await runs.list({
      tag: [itemTag(itemId)],
      limit: MAX_ITEM_RUNS,
    });

    const collected: ItemRun[] = [];
    // limit is the page size; break at MAX so auto-pagination stops after page 1
    for await (const run of page) {
      collected.push({
        id: run.id,
        status: run.status,
        taskIdentifier: run.taskIdentifier,
        createdAt: run.createdAt,
        startedAt: run.startedAt ?? null,
        finishedAt: run.finishedAt ?? null,
        durationMs: run.durationMs,
        costInCents: run.costInCents,
      });
      if (collected.length >= MAX_ITEM_RUNS) break;
    }

    return { state: "ok", runs: collected };
  } catch (error) {
    log.warn({ error, itemId }, "Failed to list Trigger runs for item");
    captureServerException(error, undefined, {
      stage: "trigger:runs.list",
      itemId,
    });
    return { state: "error" };
  }
}
