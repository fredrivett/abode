/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  ITEM_TIMELINE_ORDER_BY,
  itemTimelineCursor,
  itemTimelineCursorWhere,
} from "@/lib/items/query";
import { decodeCursor, encodeCursor } from "@/lib/pagination";

// Guards the library-timeline ordering: it MUST follow addedAt (an item's place
// in the library), NOT createdAt (row-creation time). A regression that flips
// the sort back to createdAt — the exact mistake back-dated imports depend on
// not happening — fails here regardless of how the query is written.
describe("item timeline ordering integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `timeline-${crypto.randomUUID()}@example.com`,
      },
    });
    return user.id;
  };

  const createItem = async (
    userId: string,
    dates: { createdAt: Date; addedAt: Date },
  ) => {
    const { write } = await import("@/lib/db");
    const item = await write.item.create({
      data: {
        userId,
        kind: "webpage",
        sourceType: "url",
        sourceUrl: "https://example.com/x",
        processingStatus: "completed",
        createdAt: dates.createdAt,
        addedAt: dates.addedAt,
      },
    });
    return item.id;
  };

  const listTimeline = async (userId: string) => {
    const { read } = await import("@/lib/db");
    return read.item.findMany({
      where: { userId },
      orderBy: ITEM_TIMELINE_ORDER_BY,
      select: { id: true },
    });
  };

  test("orders by addedAt, not createdAt", async () => {
    const userId = await createUser();
    // `newRowOldLibrary` was created most recently but added to the library
    // earliest (like a back-dated import); `oldRowNewLibrary` is the inverse.
    // createdAt order and addedAt order therefore disagree.
    const newRowOldLibrary = await createItem(userId, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      addedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const oldRowNewLibrary = await createItem(userId, {
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      addedAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    const order = (await listTimeline(userId)).map((i) => i.id);
    // addedAt desc → 2025 before 2020. createdAt desc would invert this.
    expect(order).toEqual([oldRowNewLibrary, newRowOldLibrary]);
  });

  test("breaks addedAt ties by id descending", async () => {
    const userId = await createUser();
    const sameAddedAt = new Date("2024-06-01T00:00:00.000Z");
    const a = await createItem(userId, {
      createdAt: sameAddedAt,
      addedAt: sameAddedAt,
    });
    const b = await createItem(userId, {
      createdAt: sameAddedAt,
      addedAt: sameAddedAt,
    });

    const order = (await listTimeline(userId)).map((i) => i.id);
    const expected = [a, b].sort((x, y) => (x > y ? -1 : 1));
    expect(order).toEqual(expected);
  });

  test("cursor keyset walks the timeline in addedAt order", async () => {
    const { read } = await import("@/lib/db");
    const userId = await createUser();
    const newRowOldLibrary = await createItem(userId, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      addedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const oldRowNewLibrary = await createItem(userId, {
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      addedAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    // First page (size 1): the most-recently-added item.
    const firstPage = await read.item.findMany({
      where: { userId },
      orderBy: ITEM_TIMELINE_ORDER_BY,
      take: 1,
      select: { id: true, addedAt: true },
    });
    expect(firstPage.map((i) => i.id)).toEqual([oldRowNewLibrary]);

    // Round-trip the cursor through the wire codec, exactly like the route.
    const cursor = decodeCursor(encodeCursor(itemTimelineCursor(firstPage[0])));
    expect(cursor).not.toBeNull();
    if (!cursor) return;

    const secondPage = await read.item.findMany({
      where: { userId, ...itemTimelineCursorWhere(cursor) },
      orderBy: ITEM_TIMELINE_ORDER_BY,
      take: 1,
      select: { id: true },
    });
    expect(secondPage.map((i) => i.id)).toEqual([newRowOldLibrary]);
  });
});
