import db from "@/lib/db";
import {
  ACTIVE_IMPORT_STATUSES,
  IMPORT_FAILED_MESSAGE,
  STRANDED_IMPORT_MS,
} from "./constants";

/**
 * Fails imports stranded in pending/importing: a chunk run that's killed
 * (maxDuration, crash) or dropped from the queue never tallies its books, so
 * the import never completes and would 409 every new import. Run on a schedule.
 */
export async function sweepStrandedImports(
  now = new Date(),
): Promise<{ stranded: number }> {
  const { count } = await db.itemImport.updateMany({
    where: {
      status: { in: [...ACTIVE_IMPORT_STATUSES] },
      createdAt: { lt: new Date(now.getTime() - STRANDED_IMPORT_MS) },
    },
    data: { status: "failed", error: IMPORT_FAILED_MESSAGE },
  });
  return { stranded: count };
}
