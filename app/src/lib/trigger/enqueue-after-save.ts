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
 * the save, or the client would roll back a change the database kept.
 */
export async function enqueueAfterSave(
  enqueue: () => Promise<unknown>,
  context: { task: string; itemId: string; userId: string },
): Promise<void> {
  if (!isTriggerConfigured()) {
    log.info(context, "Trigger.dev not configured — skipping follow-up job");
    return;
  }
  try {
    await enqueue();
  } catch (error) {
    log.warn({ error, ...context }, "Failed to enqueue follow-up job");
    captureServerException(error, context.userId, context);
  }
}
