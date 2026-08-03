import { logger, schedules } from "@trigger.dev/sdk";
import { refreshVisualEmbeddingMean } from "../src/lib/embeddings";
import { captureServerException } from "../src/lib/posthog-server";

/**
 * Daily refresh of the corpus mean vector that drives similar-images
 * mean-centering (see {@link refreshVisualEmbeddingMean}). The cone axis is
 * stable, so daily is ample — it just keeps the mean fresh as the library grows
 * and shrinks the window where a fresh deploy falls back to raw similarity.
 * Cheap (one DB-side avg + upsert) and idempotent.
 */
export const refreshVisualEmbeddingMeanTask = schedules.task({
  id: "refresh-visual-embedding-mean",
  cron: "0 4 * * *", // daily, 04:00 UTC
  maxDuration: 120,
  run: async () => {
    try {
      const n = await refreshVisualEmbeddingMean();
      logger.log("Refreshed visual embedding mean", { vectors: n });
      return { success: true, vectors: n };
    } catch (error) {
      logger.error("Visual embedding mean refresh failed", { error });
      captureServerException(error, undefined, {
        task: "refresh-visual-embedding-mean",
      });
      throw error; // rethrow so Trigger.dev retries
    }
  },
});
