/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { STRANDED_EXPORT_MS } from "@/lib/export/constants";
import { sweepDataExports } from "@/lib/export/sweep-data-exports";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function fakeStorage(removeError: Error | null = null) {
  const remove = vi.fn(async (_keys: string[]) => ({
    data: removeError ? null : [],
    error: removeError,
  }));
  return {
    supabase: {
      storage: { from: () => ({ remove }) },
    } as unknown as Parameters<typeof sweepDataExports>[0]["supabase"],
    remove,
  };
}

async function createUser() {
  const { write } = await import("@/lib/db");
  return write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `sweep-${crypto.randomUUID()}@example.com`,
    },
  });
}

describe("sweepDataExports", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("deletes expired archives and marks them expired, leaving live ones", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const expired = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "completed",
        fileKey: `${user.id}/old.zip`,
        expiresAt: new Date(NOW.getTime() - HOUR),
      },
    });
    const live = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "completed",
        fileKey: `${user.id}/new.zip`,
        expiresAt: new Date(NOW.getTime() + HOUR),
      },
    });
    const storage = fakeStorage();

    const result = await sweepDataExports({
      supabase: storage.supabase,
      now: NOW,
    });

    expect(result).toEqual({ expired: 1, stranded: 0 });
    expect(storage.remove).toHaveBeenCalledWith([`${user.id}/old.zip`]);
    expect(
      await read.dataExport.findUniqueOrThrow({ where: { id: expired.id } }),
    ).toMatchObject({ status: "expired", fileKey: null });
    expect(
      await read.dataExport.findUniqueOrThrow({ where: { id: live.id } }),
    ).toMatchObject({ status: "completed", fileKey: `${user.id}/new.zip` });
  });

  it("keeps the row (to retry next sweep) when the archive can't be deleted", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const expired = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "completed",
        fileKey: `${user.id}/old.zip`,
        expiresAt: new Date(NOW.getTime() - HOUR),
      },
    });

    await expect(
      sweepDataExports({
        supabase: fakeStorage(new Error("storage down")).supabase,
        now: NOW,
      }),
    ).rejects.toThrow("storage down");

    expect(
      await read.dataExport.findUniqueOrThrow({ where: { id: expired.id } }),
    ).toMatchObject({ status: "completed", fileKey: `${user.id}/old.zip` });
  });

  it("fails runs stranded in pending/exporting, but not recent ones", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const old = new Date(NOW.getTime() - STRANDED_EXPORT_MS - HOUR);
    const stranded = await write.dataExport.createManyAndReturn({
      data: [
        { userId: user.id, status: "pending", createdAt: old },
        { userId: user.id, status: "exporting", createdAt: old },
      ],
    });
    const recent = await write.dataExport.create({
      data: { userId: user.id, status: "exporting", createdAt: NOW },
    });

    const result = await sweepDataExports({
      supabase: fakeStorage().supabase,
      now: NOW,
    });

    expect(result).toEqual({ expired: 0, stranded: 2 });
    for (const { id } of stranded) {
      expect(
        await read.dataExport.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({ status: "failed" });
    }
    expect(
      await read.dataExport.findUniqueOrThrow({ where: { id: recent.id } }),
    ).toMatchObject({ status: "exporting" });
  });
});
