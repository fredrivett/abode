/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ProcessingStatus } from "@prisma/client";
import { claimFailedRetry } from "@/lib/items/retry-claim";

describe("claimFailedRetry integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createItem = async (processingStatus: ProcessingStatus) => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `retry-${crypto.randomUUID()}@example.com`,
      },
    });
    const item = await write.item.create({
      data: {
        userId: user.id,
        kind: "webpage",
        sourceType: "url",
        sourceUrl: "https://example.com/x",
        processingStatus,
      },
    });
    return { userId: user.id, itemId: item.id };
  };

  const statusOf = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    const rows = await read.$queryRaw<{ processing_status: string }[]>`
      SELECT processing_status FROM items WHERE id = ${itemId}::uuid
    `;
    return rows[0]?.processing_status ?? null;
  };

  test("claims a failed item and flips it to processing", async () => {
    const { userId, itemId } = await createItem("failed");
    expect(await claimFailedRetry(itemId, userId)).toBe(true);
    expect(await statusOf(itemId)).toBe("processing");
  });

  test("does not claim a non-failed item", async () => {
    const { userId, itemId } = await createItem("completed");
    expect(await claimFailedRetry(itemId, userId)).toBe(false);
  });

  test("concurrent retries of a failed item: exactly one wins (race-safe)", async () => {
    const { userId, itemId } = await createItem("failed");
    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimFailedRetry(itemId, userId)),
    );
    expect(results.filter(Boolean).length).toBe(1);
  });

  test("does not claim another user's item", async () => {
    const { itemId } = await createItem("failed");
    expect(await claimFailedRetry(itemId, crypto.randomUUID())).toBe(false);
  });
});
