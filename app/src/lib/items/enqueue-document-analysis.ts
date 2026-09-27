import { enqueueUserProcessing } from "@/lib/items/enqueue-user-processing";
import { markItemEnqueueFailed } from "@/lib/items/mark-enqueue-failed";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import type { analyzeDocumentTask } from "../../../trigger/analyze-document";

const log = createLogger("lib/items/enqueue-document-analysis");

/**
 * Enqueue OCR + cover analysis for a just-saved scanned document. Like image
 * uploads, a failure to enqueue marks the item failed (so the UI offers Retry)
 * rather than throwing — the document itself is already saved.
 */
export async function enqueueDocumentAnalysis(params: {
  itemId: string;
  userId: string;
}): Promise<void> {
  try {
    await enqueueUserProcessing<typeof analyzeDocumentTask>(
      "analyze-document",
      params,
      params.userId,
    );
  } catch (error) {
    log.error(
      { error, itemId: params.itemId },
      "Failed to enqueue document analysis",
    );
    captureServerException(error, params.userId, {
      route: "POST /api/v1/documents",
      stage: "trigger:analyze-document",
      itemId: params.itemId,
    });
    await markItemEnqueueFailed({
      itemId: params.itemId,
      context: "analyze-document",
    });
  }
}
