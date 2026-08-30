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
  /** Friendly id of the run that triggered this one, or null for a root. */
  parentRunId: string | null;
};

/** A run positioned in the forest: `indent` 0 = a root, 1 = its child, etc. */
export type ItemRunNode = { run: ItemRun; indent: number };

/**
 * Arrange the flat run list into a forest by parent id: each run nests under its
 * parent when that parent is also in the set, so a pipeline's children sit under
 * their root. A run with no parent (or whose parent isn't in the set — e.g. a
 * retry, a reprocess) is a top-level node. Emitted in pre-order — a parent
 * immediately above its children — newest root first, children oldest-first.
 */
export function buildItemRunForest(runs: ItemRun[]): ItemRunNode[] {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const childrenOf = new Map<string, ItemRun[]>();
  const roots: ItemRun[] = [];

  for (const run of runs) {
    const parentId = run.parentRunId;
    if (parentId && byId.has(parentId)) {
      const kids = childrenOf.get(parentId) ?? [];
      kids.push(run);
      childrenOf.set(parentId, kids);
    } else {
      roots.push(run);
    }
  }

  const byCreatedAsc = (a: ItemRun, b: ItemRun) =>
    a.createdAt.getTime() - b.createdAt.getTime();
  for (const kids of childrenOf.values()) kids.sort(byCreatedAsc);

  const out: ItemRunNode[] = [];
  const emit = (run: ItemRun, indent: number) => {
    out.push({ run, indent });
    for (const child of childrenOf.get(run.id) ?? []) emit(child, indent + 1);
  };
  // Newest pipeline attempt first.
  for (const root of [...roots].sort((a, b) => -byCreatedAsc(a, b))) {
    emit(root, 0);
  }
  return out;
}

export type ItemRunsResult =
  | { state: "not_configured" }
  | { state: "error" }
  | { state: "ok"; runs: ItemRun[] };

/** Best-effort lookup of a run's parent id; null on any failure or if a root. */
async function parentIdOf(runId: string): Promise<string | null> {
  try {
    const detail = await runs.retrieve(runId);
    return detail.relatedRuns?.parent?.id ?? null;
  } catch {
    return null;
  }
}

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

    const collected: Omit<ItemRun, "parentRunId">[] = [];
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

    // The list API omits lineage, so fetch each run's parent id (best-effort,
    // in parallel) to nest children under their root. A failed lookup just
    // leaves that run parent-less (rendered as a root).
    const withParents: ItemRun[] = await Promise.all(
      collected.map(async (run) => ({
        ...run,
        parentRunId: await parentIdOf(run.id),
      })),
    );

    return { state: "ok", runs: withParents };
  } catch (error) {
    log.warn({ error, itemId }, "Failed to list Trigger runs for item");
    captureServerException(error, undefined, {
      stage: "trigger:runs.list",
      itemId,
    });
    return { state: "error" };
  }
}
