/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ProcessingStatus } from "@prisma/client";
import { claimDailyReassign } from "@/lib/items/reassign-claim";

describe("claimDailyReassign integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createItem = async (
    lastReassignedAt: Date | null = null,
    processingStatus: ProcessingStatus = "completed",
  ) => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `reassign-${crypto.randomUUID()}@example.com`,
      },
    });
    const item = await write.item.create({
      data: {
        userId: user.id,
        kind: "webpage",
        sourceType: "url",
        sourceUrl: "https://example.com/x",
        processingStatus,
        lastReassignedAt,
      },
    });
    return { userId: user.id, itemId: item.id };
  };

  const processingStatusOf = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    const rows = await read.$queryRaw<{ processing_status: string }[]>`
      SELECT processing_status FROM items WHERE id = ${itemId}::uuid
    `;
    return rows[0]?.processing_status ?? null;
  };

  test("a fresh claim wins and marks the item processing", async () => {
    const { userId, itemId } = await createItem(null);
    expect(await claimDailyReassign(itemId, userId, false)).toBe(true);
    expect(await processingStatusOf(itemId)).toBe("processing");
  });

  test("a non-admin's second same-day claim loses", async () => {
    const { userId, itemId } = await createItem(null);
    expect(await claimDailyReassign(itemId, userId, false)).toBe(true);
    expect(await claimDailyReassign(itemId, userId, false)).toBe(false);
  });

  test("concurrent non-admin claims: exactly one wins (race-safe)", async () => {
    const { userId, itemId } = await createItem(null);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        claimDailyReassign(itemId, userId, false),
      ),
    );
    expect(results.filter(Boolean).length).toBe(1);
  });

  test("a claim from a previous UTC day is allowed again", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { userId, itemId } = await createItem(twoDaysAgo);
    expect(await claimDailyReassign(itemId, userId, false)).toBe(true);
  });

  test("admins are exempt from the per-day cap", async () => {
    const { userId, itemId } = await createItem(new Date());
    expect(await claimDailyReassign(itemId, userId, true)).toBe(true);
  });

  test("a non-admin can't claim another user's item", async () => {
    const { itemId } = await createItem(null);
    expect(await claimDailyReassign(itemId, crypto.randomUUID(), false)).toBe(
      false,
    );
  });

  test("does not claim an item that is already processing", async () => {
    const { userId, itemId } = await createItem(null, "processing");
    expect(await claimDailyReassign(itemId, userId, false)).toBe(false);
    expect(await claimDailyReassign(itemId, userId, true)).toBe(false);
  });

  test("concurrent admin claims: exactly one wins (single in flight)", async () => {
    const { userId, itemId } = await createItem(new Date());
    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimDailyReassign(itemId, userId, true)),
    );
    expect(results.filter(Boolean).length).toBe(1);
  });
});
