import { tags, tasks } from "@trigger.dev/sdk";
import { itemRunTags } from "../src/lib/items/run-tags";
import { captureServerException } from "../src/lib/posthog-server";

/**
 * Item-processing task payloads all carry the item and its owner. Narrow to
 * those so a single global hook can tag any item run, whatever the task.
 */
function isItemPayload(
  payload: unknown,
): payload is { itemId: string; userId: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "itemId" in payload &&
    typeof payload.itemId === "string" &&
    "userId" in payload &&
    typeof payload.userId === "string"
  );
}

/** The item/user run tags for a payload, or `[]` when it isn't an item task. */
export function itemRunTagsForPayload(payload: unknown): string[] {
  return isItemPayload(payload) ? itemRunTags(payload) : [];
}

/**
 * Global hook: every run whose payload identifies an item self-tags with
 * `item_<id>`/`user_<id>` as it starts, so the whole run tree — children of a
 * pipeline included — is findable by item without threading tags through each
 * `tasks.trigger` call. Trigger doesn't propagate tags to child runs, and this
 * is the one place that fills that gap.
 *
 * Top-level user runs are *also* tagged at trigger time in
 * `enqueueUserProcessing` so they're findable even while still queued (this hook
 * only fires once a run starts executing); `tags.add` de-dupes the overlap.
 *
 * Global hooks are registered by loading this file — Trigger discovers `init.ts`
 * in the `dirs: ["trigger"]` roots.
 */
tasks.onStartAttempt(async ({ payload }) => {
  const runTags = itemRunTagsForPayload(payload);
  if (runTags.length === 0) return;

  // Tags are best-effort metadata — a tag API hiccup must never reject this
  // hook and fail the run it's about to start. Report and continue. We report
  // via captureServerException only (no task-scoped SDK logger) so the recovery
  // path itself can't throw.
  try {
    await tags.add(runTags);
  } catch (error) {
    captureServerException(error, undefined, {
      stage: "trigger:onStartAttempt:tags.add",
    });
  }
});
