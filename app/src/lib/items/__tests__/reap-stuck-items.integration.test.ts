/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ProcessingStatus } from "@prisma/client";
import { reapStuckItems } from "@/lib/items/reap-stuck-items";

const HOUR = 60 * 60 * 1000;

describe("reapStuckItems", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const seedItem = async (
    status: ProcessingStatus,
    startedAgoMs: number,
  ): Promise<string> => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `reap-${crypto.randomUUID()}@example.com`,
      },
    });
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "webpage",
        processingStatus: status,
        processingStartedAt: new Date(Date.now() - startedAgoMs),
      },
      select: { id: true },
    });
    return item.id;
  };

  const statusOf = async (id: string) => {
    const { read } = await import("@/lib/db");
    const row = await read.item.findUniqueOrThrow({
      where: { id },
      select: { processingStatus: true, processingError: true },
    });
    return row;
  };

  test("marks only stale processing/pending items as failed+stalled", async () => {
    const staleProcessing = await seedItem("processing", 3 * HOUR);
    const stalePending = await seedItem("pending", 3 * HOUR);
    const freshProcessing = await seedItem("processing", 10 * 60 * 1000); // 10 min
    const completed = await seedItem("completed", 5 * HOUR);
    const alreadyFailed = await seedItem("failed", 5 * HOUR);

    const { reaped } = await reapStuckItems({
      olderThan: new Date(Date.now() - 2 * HOUR),
    });

    expect(reaped).toBe(2);

    for (const id of [staleProcessing, stalePending]) {
      const row = await statusOf(id);
      expect(row.processingStatus).toBe("failed");
      expect(row.processingError).toBe("stalled");
    }

    // Untouched
    expect((await statusOf(freshProcessing)).processingStatus).toBe(
      "processing",
    );
    expect((await statusOf(completed)).processingStatus).toBe("completed");
    const failed = await statusOf(alreadyFailed);
    expect(failed.processingStatus).toBe("failed");
    expect(failed.processingError).toBeNull(); // not overwritten with 'stalled'
  });

  test("no-op when nothing is stale", async () => {
    await seedItem("processing", 5 * 60 * 1000);
    const { reaped } = await reapStuckItems({
      olderThan: new Date(Date.now() - 2 * HOUR),
    });
    expect(reaped).toBe(0);
  });

  test("still reaps when a recent edit bumped updatedAt (clock is processingStartedAt)", async () => {
    const { write } = await import("@/lib/db");
    const id = await seedItem("processing", 5 * HOUR);
    // Simulate an unrelated user edit just now — bumps @updatedAt but NOT
    // processingStartedAt, so the reaper must still catch it.
    await write.item.update({ where: { id }, data: { userTags: ["edited"] } });

    const { reaped } = await reapStuckItems({
      olderThan: new Date(Date.now() - 2 * HOUR),
    });

    expect(reaped).toBe(1);
    expect((await statusOf(id)).processingStatus).toBe("failed");
  });
});
