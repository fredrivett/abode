/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { MAX_EXPORTS_PER_DAY } from "@/lib/export/constants";
import {
  lockUserDataExports,
  reserveDataExport,
} from "@/lib/export/reserve-data-export";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createUser() {
  const { write } = await import("@/lib/db");
  return write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `reserve-${crypto.randomUUID()}@example.com`,
    },
  });
}

describe("reserveDataExport", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("waits for a concurrent reservation instead of creating a second export", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    // Another request mid-reservation: holds the lock, then creates its export
    let lockHeld!: () => void;
    const locked = new Promise<void>((resolve) => {
      lockHeld = resolve;
    });
    const other = write.$transaction(async (tx) => {
      await lockUserDataExports(tx, user.id);
      lockHeld();
      await sleep(200);
      await tx.dataExport.create({ data: { userId: user.id } });
    });
    // Only reserve once the lock is definitely taken
    await locked;

    const result = await reserveDataExport(user.id);
    await other;

    expect(result.status).toBe("in_progress");
  });

  it("creates only one export when requests race", async () => {
    const { read } = await import("@/lib/db");
    const user = await createUser();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => reserveDataExport(user.id)),
    );

    const created = results.filter((r) => r.status === "created");
    expect(created).toHaveLength(1);
    expect(results.filter((r) => r.status === "in_progress")).toHaveLength(5);
    expect(await read.dataExport.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses once the user has hit the daily cap", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    await write.dataExport.createMany({
      data: Array.from({ length: MAX_EXPORTS_PER_DAY }, () => ({
        userId: user.id,
        status: "completed" as const,
      })),
    });

    expect(await reserveDataExport(user.id)).toEqual({ status: "daily_limit" });
  });

  it("doesn't count failed runs toward the daily cap", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    await write.dataExport.createMany({
      data: Array.from({ length: MAX_EXPORTS_PER_DAY }, () => ({
        userId: user.id,
        status: "failed" as const,
      })),
    });

    expect((await reserveDataExport(user.id)).status).toBe("created");
  });

  it("allows a new export once yesterday's have aged out", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await write.dataExport.createMany({
      data: Array.from({ length: MAX_EXPORTS_PER_DAY }, () => ({
        userId: user.id,
        status: "completed" as const,
        createdAt: yesterday,
      })),
    });

    expect((await reserveDataExport(user.id)).status).toBe("created");
  });

  it("doesn't count or block on other users' exports", async () => {
    const [user, other] = await Promise.all([createUser(), createUser()]);
    await reserveDataExport(other.id);
    expect((await reserveDataExport(user.id)).status).toBe("created");
  });
});
