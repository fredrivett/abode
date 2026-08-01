import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/items/mark-processing-active");

/**
 * Advance an item's `processingStartedAt` to now, recording that a pipeline
 * stage is actively working on it. An item stays `processing` across a *chain*
 * of runs (classify-url → analyze-media-cover → enrich-item, etc.), so if the
 * clock were only set once at capture, a legitimately-slow multi-stage pipeline
 * could exceed the reaper threshold and be marked `stalled` mid-flight. Calling
 * this at the start of each stage keeps the reaper measuring "time since the
 * last active stage", so the threshold only needs to cover one stage's lifespan.
 *
 * Guarded on non-terminal status: a stale/late run can't resurrect the clock of
 * an item that already completed, failed, or was reaped. Best-effort — a bump
 * that fails must never fail the surrounding task.
 */
export async function markProcessingActive(itemId: string): Promise<void> {
  try {
    await db.item.updateMany({
      where: {
        id: itemId,
        processingStatus: { in: ["processing", "pending"] },
      },
      data: { processingStartedAt: new Date() },
    });
  } catch (error) {
    log.warn({ error, itemId }, "Failed to advance processingStartedAt");
  }
}
