import { systemDb } from "@/lib/db";

/**
 * Mark an export / import the user just created as failed because its
 * background job never enqueued — otherwise it sits `pending`/`importing` and
 * 409s every retry until the sweeper gives up on it. After creation the job
 * owns these rows (users can only insert and read them), so this runs on the
 * system connection; it only ever touches the row the caller just created.
 */
export async function failUnstartedExport(exportId: string): Promise<void> {
  await systemDb.dataExport.update({
    where: { id: exportId },
    data: { status: "failed", error: "Couldn't start the export" },
  });
}

export async function failUnstartedImport(importId: string): Promise<void> {
  await systemDb.itemImport.update({
    where: { id: importId },
    data: { status: "failed", error: "Couldn't start the import" },
  });
}
