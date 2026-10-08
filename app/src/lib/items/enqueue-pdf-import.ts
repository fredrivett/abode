import { enqueueUserProcessing } from "@/lib/items/enqueue-user-processing";
import { markItemEnqueueFailed } from "@/lib/items/mark-enqueue-failed";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import type { importPdfTask } from "../../../trigger/import-pdf";

const log = createLogger("lib/items/enqueue-pdf-import");

/**
 * Enqueue page rendering + analysis for a just-saved (or retried) PDF document.
 * Like document analysis, a failure to enqueue marks the item failed (so the
 * UI offers Retry) rather than throwing — the document is already saved.
 */
export async function enqueuePdfImport(params: {
  itemId: string;
  userId: string;
}): Promise<void> {
  try {
    await enqueueUserProcessing<typeof importPdfTask>(
      "import-pdf",
      params,
      params.userId,
    );
  } catch (error) {
    log.error({ error, itemId: params.itemId }, "Failed to enqueue PDF import");
    captureServerException(error, params.userId, {
      stage: "trigger:import-pdf",
      itemId: params.itemId,
    });
    await markItemEnqueueFailed({
      itemId: params.itemId,
      context: "import-pdf",
    });
  }
}
