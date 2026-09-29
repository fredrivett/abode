/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { STRANDED_EXPORT_MS } from "@/lib/export/constants";
import { sweepDataExports } from "@/lib/export/sweep-data-exports";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

/**
 * In-memory exports bucket: `objects` are the stored paths, `list`/`remove`
 * behave like Supabase's (one folder level at a time, sub-folders as id: null).
 */
function fakeStorage(
  removeError: Error | null = null,
  objects: Set<string> = new Set(),
) {
  const remove = vi.fn(async (keys: string[]) => {
    if (removeError) return { data: null, error: removeError };
    for (const key of keys) objects.delete(key);
    return { data: [], error: null };
  });
  const list = vi.fn(async (prefix: string) => {
    const children = new Map<string, string | null>();
    for (const path of objects) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const [name, ...rest] = path.slice(prefix.length + 1).split("/");
      children.set(name, rest.length > 0 ? null : path);
    }
    return {
      data: [...children].map(([name, id]) => ({ name, id })),
      error: null,
    };
  });
  return {
    supabase: {
      storage: { from: () => ({ remove, list }) },
    } as unknown as Parameters<typeof sweepDataExports>[0]["supabase"],
    remove,
    objects,
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
        expiresAt: new Date(NOW.getTime() - HOUR),
        parts: {
          create: [
            { position: 1, fileKey: `${user.id}/old/part-1.zip`, sizeBytes: 1 },
            { position: 2, fileKey: `${user.id}/old/part-2.zip`, sizeBytes: 1 },
          ],
        },
      },
    });
    const live = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "completed",
        expiresAt: new Date(NOW.getTime() + HOUR),
        parts: {
          create: {
            position: 1,
            fileKey: `${user.id}/new/part-1.zip`,
            sizeBytes: 1,
          },
        },
      },
    });
    const storage = fakeStorage();

    const result = await sweepDataExports({
      supabase: storage.supabase,
      now: NOW,
    });

    expect(result).toEqual({ expired: 1, stranded: 0 });
    expect(storage.remove).toHaveBeenCalledWith([
      `${user.id}/old/part-1.zip`,
      `${user.id}/old/part-2.zip`,
    ]);
    expect(
      await read.dataExport.findUniqueOrThrow({
        where: { id: expired.id },
        include: { parts: true },
      }),
    ).toMatchObject({ status: "expired", parts: [] });
    expect(
      await read.dataExport.findUniqueOrThrow({
        where: { id: live.id },
        include: { parts: true },
      }),
    ).toMatchObject({
      status: "completed",
      parts: [
        expect.objectContaining({ fileKey: `${user.id}/new/part-1.zip` }),
      ],
    });
  });

  it("keeps the row (to retry next sweep) when the archive can't be deleted", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const expired = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "completed",
        expiresAt: new Date(NOW.getTime() - HOUR),
        parts: {
          create: {
            position: 1,
            fileKey: `${user.id}/old/part-1.zip`,
            sizeBytes: 1,
          },
        },
      },
    });

    await expect(
      sweepDataExports({
        supabase: fakeStorage(new Error("storage down")).supabase,
        now: NOW,
      }),
    ).rejects.toThrow("storage down");

    expect(
      await read.dataExport.findUniqueOrThrow({
        where: { id: expired.id },
        include: { parts: true },
      }),
    ).toMatchObject({ status: "completed", parts: [expect.anything()] });
  });

  it("still releases stranded runs when an archive can't be deleted", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    await write.dataExport.create({
      data: {
        userId: user.id,
        status: "completed",
        expiresAt: new Date(NOW.getTime() - HOUR),
        parts: {
          create: {
            position: 1,
            fileKey: `${user.id}/old/part-1.zip`,
            sizeBytes: 1,
          },
        },
      },
    });
    const stranded = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "exporting",
        createdAt: new Date(NOW.getTime() - STRANDED_EXPORT_MS - HOUR),
      },
    });

    await expect(
      sweepDataExports({
        supabase: fakeStorage(new Error("storage down")).supabase,
        now: NOW,
      }),
    ).rejects.toThrow("storage down");

    expect(
      await read.dataExport.findUniqueOrThrow({ where: { id: stranded.id } }),
    ).toMatchObject({ status: "failed" });
  });

  it("deletes parts a stranded run uploaded before it died", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const run = await write.dataExport.create({
      data: {
        userId: user.id,
        status: "exporting",
        createdAt: new Date(NOW.getTime() - STRANDED_EXPORT_MS - HOUR),
      },
    });
    const storage = fakeStorage(
      null,
      new Set([
        `${user.id}/${run.id}/part-1.zip`,
        `${user.id}/${run.id}/part-2.zip`,
        `${user.id}/other-export/part-1.zip`,
      ]),
    );

    await sweepDataExports({ supabase: storage.supabase, now: NOW });

    expect([...storage.objects]).toEqual([
      `${user.id}/other-export/part-1.zip`,
    ]);
    expect(
      await read.dataExport.findUniqueOrThrow({ where: { id: run.id } }),
    ).toMatchObject({ status: "failed" });
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
