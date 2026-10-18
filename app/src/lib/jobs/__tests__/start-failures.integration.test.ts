/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { recordViewer, runInViewerFrame } from "@/lib/viewer-context";

// Exports and imports are insert-and-read for their owner under RLS (the job
// owns later writes), so a route that fails to enqueue the job can't mark its
// own row failed through `db` — failUnstartedExport/Import can
describe("failing an export or import whose job never started", () => {
  let userId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    const { systemDb } = await import("@/lib/db");
    userId = crypto.randomUUID();
    await systemDb.user.create({
      data: { id: userId, email: "jobs@example.com", username: "jobs" },
    });
  });

  beforeEach(() => vi.stubEnv("RLS_ENFORCED", "true"));
  afterEach(() => vi.unstubAllEnvs());

  const asOwner = <T>(run: () => Promise<T>) =>
    runInViewerFrame(async () => {
      recordViewer(userId);
      return run();
    });

  it("marks the export failed, which the owner's own connection can't", async () => {
    const { default: db, systemDb } = await import("@/lib/db");
    const { failUnstartedExport } = await import("@/lib/jobs/start-failures");
    const created = await asOwner(() =>
      db.dataExport.create({ data: { userId }, select: { id: true } }),
    );

    // What the route used to do: refused under RLS
    const direct = await asOwner(() =>
      db.dataExport.updateMany({
        where: { id: created.id },
        data: { status: "failed" },
      }),
    );
    expect(direct.count).toBe(0);

    await asOwner(() => failUnstartedExport(created.id));

    const row = await systemDb.dataExport.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row).toMatchObject({
      status: "failed",
      error: "Couldn't start the export",
    });
  });

  it("marks the import failed", async () => {
    const { default: db, systemDb } = await import("@/lib/db");
    const { failUnstartedImport } = await import("@/lib/jobs/start-failures");
    const created = await asOwner(() =>
      db.itemImport.create({
        data: { userId, source: "literal", status: "importing" },
        select: { id: true },
      }),
    );

    await asOwner(() => failUnstartedImport(created.id));

    const row = await systemDb.itemImport.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row).toMatchObject({
      status: "failed",
      error: "Couldn't start the import",
    });
  });

  it("leaves a job that did start alone, if the trigger call errors late", async () => {
    const { systemDb } = await import("@/lib/db");
    const { failUnstartedExport, failUnstartedImport } = await import(
      "@/lib/jobs/start-failures"
    );
    const running = await systemDb.dataExport.create({
      data: { userId, status: "exporting" },
      select: { id: true },
    });
    const progressing = await systemDb.itemImport.create({
      data: {
        userId,
        source: "literal",
        status: "importing",
        importedCount: 3,
      },
      select: { id: true },
    });

    await asOwner(async () => {
      await failUnstartedExport(running.id);
      await failUnstartedImport(progressing.id);
    });

    const exportRow = await systemDb.dataExport.findUniqueOrThrow({
      where: { id: running.id },
    });
    const importRow = await systemDb.itemImport.findUniqueOrThrow({
      where: { id: progressing.id },
    });
    expect(exportRow.status).toBe("exporting");
    expect(importRow.status).toBe("importing");
  });
});
