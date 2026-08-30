import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/items/mark-enqueue-failed");

/**
 * Flip an item to `failed` with a concrete `enqueue_failed` reason after a
 * Trigger enqueue throws, so the failure reports as `enqueue_failed` rather
 * than a null the admin UI has to paper over, and the item surfaces a Retry
 * instead of spinning forever.
 *
 * Best-effort: the item is already persisted, so a failure to mark it must
 * never bubble and fail the surrounding save/task. `context` names the enqueue
 * site (e.g. "classify-url") for the swallowed-error log.
 */
export async function markItemEnqueueFailed({
  itemId,
  context,
}: {
  itemId: string;
  context: string;
}): Promise<void> {
  await db.item
    .update({
      where: { id: itemId },
      data: { processingStatus: "failed", processingError: "enqueue_failed" },
    })
    .catch((updateError) => {
      log.error(
        { updateError, itemId, context },
        "Failed to mark item failed after enqueue error",
      );
    });
}
