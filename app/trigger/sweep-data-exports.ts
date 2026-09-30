import { createClient } from "@supabase/supabase-js";
import { logger, schedules } from "@trigger.dev/sdk";
import { sweepDataExports } from "../src/lib/export/sweep-data-exports";
import { captureServerException } from "../src/lib/posthog-server";

function supabaseServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase config for sweep-data-exports");
  }
  return createClient(url, key);
}

/**
 * Hourly: deletes expired export archives and fails stranded export runs so
 * they stop blocking new requests. See sweepDataExports.
 */
export const sweepDataExportsTask = schedules.task({
  id: "sweep-data-exports",
  cron: "20 * * * *", // hourly, offset from the other hourly sweeps
  maxDuration: 120,
  run: async () => {
    try {
      const result = await sweepDataExports({
        supabase: supabaseServiceClient(),
      });
      logger.log("Swept data exports", result);
      return { success: true, ...result };
    } catch (error) {
      logger.error("Data export sweep failed", { error });
      captureServerException(error, undefined, { task: "sweep-data-exports" });
      throw error;
    }
  },
});
