import { logger, schedules } from "@trigger.dev/sdk";
import { resumeDeferredItems } from "../src/lib/items/resume-deferred-items";
import { captureServerException } from "../src/lib/posthog-server";

/**
 * Daily sweep that resumes items parked as `deferred` (over the interactive
 * reserve when they were enqueued) — see {@link resumeDeferredItems}. Runs just
 * after the UTC-midnight allowance reset so a fresh day's headroom is available;
 * whatever doesn't fit under a user's reserve stays deferred for the next run.
 */
export const resumeDeferredItemsTask = schedules.task({
  id: "resume-deferred-items",
  cron: "0 1 * * *", // Daily 01:00 UTC — after the daily allowance resets at 00:00
  maxDuration: 300,
  run: async () => {
    try {
      const { enqueued, stillDeferred } = await resumeDeferredItems();
      logger.log("Resumed deferred items", { enqueued, stillDeferred });
      return { success: true, enqueued, stillDeferred };
    } catch (error) {
      logger.error("Resume-deferred sweep failed", { error });
      captureServerException(error, undefined, {
        task: "resume-deferred-items",
      });
      throw error; // rethrow so Trigger.dev retries the sweep
    }
  },
});
