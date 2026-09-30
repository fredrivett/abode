/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { BookReadingStatus, RoomAutoKind } from "@prisma/client";

describe("ensureBookRooms", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async (dismissedAutoRooms: RoomAutoKind[] = []) => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@example.com`,
        dismissedAutoRooms,
      },
    });
  };

  const createBook = async (
    userId: string,
    status: BookReadingStatus | null = null,
  ) => {
    const { write } = await import("@/lib/db");
    return write.item.create({
      data: {
        userId,
        kind: "book",
        sourceType: "url",
        bookDetails: { create: { status } },
      },
    });
  };

  const autoRooms = async (userId: string) => {
    const { read } = await import("@/lib/db");
    return read.room.findMany({
      where: { userId, autoKind: { not: null } },
      orderBy: { autoKind: "asc" },
    });
  };

  it("creates the three shelves once the user has a book", async () => {
    const user = await createUser();
    await createBook(user.id, "reading");
    const { ensureBookRooms } = await import("@/lib/rooms/auto-book-rooms");

    await ensureBookRooms(user.id);

    const rooms = await autoRooms(user.id);
    expect(rooms.map((r) => r.autoKind).sort()).toEqual([
      "book_read",
      "book_reading",
      "book_want_to_read",
    ]);
    for (const room of rooms) {
      expect(room.type).toBe("smart");
      expect(room.visibility).toBe("private");
      expect(room.slug).toBeTruthy();
    }
    const reading = rooms.find((r) => r.autoKind === "book_reading");
    expect(reading?.filters).toEqual([
      expect.objectContaining({ type: "type", value: "book", negated: false }),
      expect.objectContaining({
        type: "status",
        value: "reading",
        negated: false,
      }),
    ]);
  });

  it("does nothing when the user has no books", async () => {
    const user = await createUser();
    const { ensureBookRooms } = await import("@/lib/rooms/auto-book-rooms");

    await ensureBookRooms(user.id);

    expect(await autoRooms(user.id)).toHaveLength(0);
  });

  it("is idempotent — a second call creates nothing new", async () => {
    const user = await createUser();
    await createBook(user.id, "read");
    const { ensureBookRooms } = await import("@/lib/rooms/auto-book-rooms");

    await ensureBookRooms(user.id);
    await ensureBookRooms(user.id);

    expect(await autoRooms(user.id)).toHaveLength(3);
  });

  it("skips dismissed kinds and never recreates them", async () => {
    const user = await createUser(["book_reading"]);
    await createBook(user.id, "reading");
    const { ensureBookRooms } = await import("@/lib/rooms/auto-book-rooms");

    await ensureBookRooms(user.id);

    const rooms = await autoRooms(user.id);
    expect(rooms.map((r) => r.autoKind).sort()).toEqual([
      "book_read",
      "book_want_to_read",
    ]);

    // A second pass with a matching reading book still doesn't recreate it.
    await ensureBookRooms(user.id);
    expect(
      (await autoRooms(user.id)).some((r) => r.autoKind === "book_reading"),
    ).toBe(false);
  });

  it("populates each shelf by reading status", async () => {
    const user = await createUser();
    const reading = await createBook(user.id, "reading");
    const wantToRead = await createBook(user.id, "want_to_read");
    const read = await createBook(user.id, "read");
    const untracked = await createBook(user.id, null);
    const { ensureBookRooms } = await import("@/lib/rooms/auto-book-rooms");

    await ensureBookRooms(user.id);

    const { read: db } = await import("@/lib/db");
    const rooms = await autoRooms(user.id);
    const membership = async (kind: RoomAutoKind) => {
      const room = rooms.find((r) => r.autoKind === kind);
      if (!room) throw new Error(`missing shelf ${kind}`);
      const items = await db.roomItem.findMany({
        where: { roomId: room.id },
        select: { itemId: true },
      });
      return items.map((i) => i.itemId).sort();
    };

    expect(await membership("book_reading")).toEqual([reading.id]);
    expect(await membership("book_want_to_read")).toEqual([wantToRead.id]);
    expect(await membership("book_read")).toEqual([read.id]);
    // The untracked book (null status) belongs to no shelf.
    expect(await membership("book_reading")).not.toContain(untracked.id);
    expect(await membership("book_read")).not.toContain(untracked.id);
  });
});
