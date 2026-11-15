import { logger, schedules } from "@trigger.dev/sdk";
import { sweepStrandedImports } from "../src/lib/imports/sweep-stranded-imports";
import { captureServerException } from "../src/lib/posthog-server";

/**
 * Hourly: fails book imports stranded by a killed or dropped chunk so they stop
 * blocking new imports. See sweepStrandedImports.
 */
export const sweepStrandedImportsTask = schedules.task({
  id: "sweep-stranded-imports",
  cron: "40 * * * *", // hourly, offset from the other hourly sweeps
  retry: { maxAttempts: 3 }, // idempotent
  maxDuration: 60,
  run: async () => {
    const result = await sweepStrandedImports();
    logger.log("Swept stranded imports", result);
    return { success: true, ...result };
  },
  onFailure: async ({ error }) => {
    captureServerException(error, undefined, {
      task: "sweep-stranded-imports",
    });
  },
});
