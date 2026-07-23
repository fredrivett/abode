import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import type { analyzeImageTask } from "../../../trigger/analyze-image";

const log = createLogger("lib/items/enqueue-image-analysis");

/**
 * Enqueue image enrichment for a just-created item.
 *
 * The item is already persisted by the caller; enrichment is a separate
 * concern (graceful degradation — see AGENTS.md). If enqueuing fails
 * (Trigger.dev unconfigured or unreachable) we mark the item failed so the UI
 * offers Retry, and never throw — capturing an item must not fail just because
 * enrichment couldn't be started.
 */
export async function enqueueImageAnalysis(params: {
  itemId: string;
  userId: string;
  fileKey: string;
}): Promise<void> {
  try {
    await tasks.trigger<typeof analyzeImageTask>("analyze-image", params);
  } catch (error) {
    log.error(
      { error, itemId: params.itemId },
      "Failed to enqueue image analysis",
    );
    captureServerException(error, params.userId, {
      route: "POST /api/v1/items",
      stage: "trigger:analyze-image",
      itemId: params.itemId,
    });
    await db.item
      .update({
        where: { id: params.itemId },
        data: { processingStatus: "failed" },
      })
      .catch((updateError) => {
        log.error(
          { updateError, itemId: params.itemId },
          "Failed to mark item failed after enqueue error",
        );
      });
  }
}
