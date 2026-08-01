/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ProcessingStatus } from "@prisma/client";
import { markProcessingActive } from "@/lib/items/mark-processing-active";

describe("markProcessingActive", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const seed = async (status: ProcessingStatus): Promise<string> => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `mpa-${crypto.randomUUID()}@example.com`,
      },
    });
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "webpage",
        processingStatus: status,
        // one hour ago, so an advance is clearly observable
        processingStartedAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      select: { id: true, processingStartedAt: true },
    });
    return item.id;
  };

  const startedAt = async (id: string) => {
    const { read } = await import("@/lib/db");
    const row = await read.item.findUniqueOrThrow({
      where: { id },
      select: { processingStartedAt: true },
    });
    return row.processingStartedAt;
  };

  test("advances processingStartedAt for a non-terminal item", async () => {
    for (const status of ["processing", "pending"] as const) {
      const id = await seed(status);
      const before = await startedAt(id);
      await markProcessingActive(id);
      const after = await startedAt(id);
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    }
  });

  test("no-ops for a terminal item (can't resurrect the clock)", async () => {
    for (const status of ["completed", "failed"] as const) {
      const id = await seed(status);
      const before = await startedAt(id);
      await markProcessingActive(id);
      const after = await startedAt(id);
      expect(after.getTime()).toBe(before.getTime());
    }
  });
});
