import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import {
  markDataExportFailed,
  runDataExport,
} from "../src/lib/export/run-data-export";
import { captureServerException } from "../src/lib/posthog-server";

function supabaseServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase config for export-user-data");
  }
  return createClient(url, key);
}

type ExportUserDataPayload = { exportId: string; userId: string };

/**
 * Builds a user's requested data export (see runDataExport, which holds the
 * testable orchestration). No auto-retry: a failure marks the export failed so
 * the user sees it and can request another, rather than a retry racing the
 * status the settings page is polling.
 */
export const exportUserDataTask = task({
  id: "export-user-data",
  retry: { maxAttempts: 1 },
  // Well inside STRANDED_EXPORT_MS (with the project's 2h queue TTL)
  maxDuration: 900,
  run: async ({ exportId, userId }: ExportUserDataPayload) => {
    try {
      const result = await runDataExport({
        exportId,
        supabase: supabaseServiceClient(),
      });
      logger.log("Data export finished", { exportId, ...result });
      return { success: true, ...result };
    } catch (error) {
      logger.error("Data export failed", { exportId, error });
      captureServerException(error, userId, {
        task: "export-user-data",
        exportId,
      });
      await markDataExportFailed(exportId);
      throw error;
    }
  },
});
