import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("trigger/enqueue-after-save");

// Reads process.env rather than isTriggerConfigured (@/env.server): this module
// reaches Trigger.dev tasks through note-embedding, and env.server's
// "server-only" import breaks them (same reason as posthog-server)
function isTriggerConfigured() {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

/**
 * Queue a follow-up job for a save that has already been written. Trigger.dev
 * is optional: without it, skip; a queueing failure is reported but never fails
 * the save, or the client would roll back a change the database kept. Returns
 * what `enqueue` resolved to (e.g. the run handle), or null when nothing queued.
 */
export async function enqueueAfterSave<T>(
  enqueue: () => Promise<T>,
  context: { task: string; userId: string; itemId?: string; roomId?: string },
): Promise<T | null> {
  if (!isTriggerConfigured()) {
    log.info(context, "Trigger.dev not configured — skipping follow-up job");
    return null;
  }
  try {
    return await enqueue();
  } catch (error) {
    log.warn({ error, ...context }, "Failed to enqueue follow-up job");
    captureServerException(error, context.userId, context);
    return null;
  }
}
