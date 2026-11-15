/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  IMPORT_FAILED_MESSAGE,
  STRANDED_IMPORT_MS,
} from "@/lib/imports/constants";
import { sweepStrandedImports } from "@/lib/imports/sweep-stranded-imports";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const MINUTE = 60 * 1000;

describe("sweepStrandedImports", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("fails only active imports older than the stranded threshold", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `sweep-import-${crypto.randomUUID()}@example.com`,
      },
    });
    const old = new Date(NOW.getTime() - STRANDED_IMPORT_MS - MINUTE);
    const recent = new Date(NOW.getTime() - STRANDED_IMPORT_MS + MINUTE);
    const create = (
      status: "pending" | "importing" | "completed",
      createdAt: Date,
    ) =>
      write.itemImport.create({
        data: { userId: user.id, source: "literal", status, createdAt },
      });
    const strandedImporting = await create("importing", old);
    const strandedPending = await create("pending", old);
    const running = await create("importing", recent);
    const finished = await create("completed", old);

    expect(await sweepStrandedImports(NOW)).toEqual({ stranded: 2 });

    const status = async (id: string) =>
      read.itemImport.findUniqueOrThrow({
        where: { id },
        select: { status: true, error: true },
      });
    expect(await status(strandedImporting.id)).toEqual({
      status: "failed",
      error: IMPORT_FAILED_MESSAGE,
    });
    expect((await status(strandedPending.id)).status).toBe("failed");
    expect((await status(running.id)).status).toBe("importing");
    expect(await status(finished.id)).toEqual({
      status: "completed",
      error: null,
    });
  });
});
