/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

// A visitor's view of a public room must not count items whose privacy level
// keeps them out of public rooms, or the count reveals that hidden items exist
describe("public room item counts", () => {
  let userId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    const { write } = await import("@/lib/db");
    userId = crypto.randomUUID();
    await write.user.create({
      data: { id: userId, email: "counts@example.com", username: "counter" },
    });
    const item = (privacy: "standard" | "unlisted" | "sensitive") =>
      write.item.create({
        data: {
          userId,
          kind: "note",
          sourceType: "compose",
          processingStatus: "completed",
          privacy,
        },
        select: { id: true },
      });
    const [visible, unlisted, sensitive] = await Promise.all([
      item("standard"),
      item("unlisted"),
      item("sensitive"),
    ]);
    await write.room.create({
      data: {
        userId,
        name: "Public",
        slug: "public",
        type: "manual",
        visibility: "public",
        roomItems: {
          create: [
            { itemId: visible.id },
            { itemId: unlisted.id },
            { itemId: sensitive.id },
          ],
        },
      },
    });
  });

  test("profile room cards count only visible items", async () => {
    const { listPublicRooms } = await import("@/lib/rooms/public-rooms");
    const rooms = await listPublicRooms(userId);
    expect(rooms.map((room) => room._count.roomItems)).toEqual([1]);
  });

  test("the room's share card counts only visible items", async () => {
    const { getOgRoom } = await import("@/lib/og/data");
    expect((await getOgRoom("counter", "public"))?.itemCount).toBe(1);
  });
});
