import { systemDb } from "@/lib/db";

/**
 * Mark an export / import the user just created as failed because its
 * background job never enqueued — otherwise it sits `pending`/`importing` and
 * 409s every retry until the sweeper gives up on it. After creation the job
 * owns these rows (users can only insert and read them), so this runs on the
 * system connection; it only ever touches the row the caller just created.
 */
export async function failUnstartedExport(exportId: string): Promise<void> {
  // Only while still unstarted: a trigger call can report an error after the
  // job was accepted, and that run's progress mustn't be overwritten
  await systemDb.dataExport.updateMany({
    where: { id: exportId, status: "pending" },
    data: { status: "failed", error: "Couldn't start the export" },
  });
}

export async function failUnstartedImport(importId: string): Promise<void> {
  // Only while still at its initial status — see failUnstartedExport
  await systemDb.itemImport.updateMany({
    where: { id: importId, status: "importing", importedCount: 0 },
    data: { status: "failed", error: "Couldn't start the import" },
  });
}
