import { logger, schedules } from "@trigger.dev/sdk";
import {
  reapStuckItems,
  STUCK_ITEM_THRESHOLD_MS,
} from "../src/lib/items/reap-stuck-items";
import { captureServerException } from "../src/lib/posthog-server";

/**
 * Hourly backstop: mark items stranded in `processing`/`pending` past the
 * staleness threshold as `failed` (reason `stalled`). Catches runs that died
 * after enqueue (OOM, timeout, dropped) — the one case a task's own catch can't
 * reach. See {@link reapStuckItems}.
 */
export const reapStuckItemsTask = schedules.task({
  id: "reap-stuck-items",
  cron: "0 * * * *", // hourly
  maxDuration: 60,
  run: async () => {
    const olderThan = new Date(Date.now() - STUCK_ITEM_THRESHOLD_MS);
    try {
      const { reaped } = await reapStuckItems({ olderThan });
      logger.log("Swept stuck items", {
        reaped,
        olderThan: olderThan.toISOString(),
      });
      return { success: true, reaped };
    } catch (error) {
      logger.error("Stuck-items sweep failed", { error });
      captureServerException(error, undefined, { task: "reap-stuck-items" });
      throw error; // rethrow so Trigger.dev retries the sweep
    }
  },
});
