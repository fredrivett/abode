/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

vi.mock("@/lib/user", () => ({ getAuthenticatedUser: async () => null }));

// On public pages visitors get city-level locations only: exact coordinates,
// neighborhood and the formatted street address never reach them. The owner
// viewing their own public item or room still sees everything.
describe("public item locations", () => {
  let itemId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    const { write } = await import("@/lib/db");
    const userId = crypto.randomUUID();
    await write.user.create({
      data: { id: userId, email: "places@example.com", username: "traveller" },
    });
    const item = await write.item.create({
      data: {
        userId,
        kind: "image",
        sourceType: "upload",
        processingStatus: "completed",
        sharedAt: new Date(),
        locations: {
          create: {
            userId,
            source: "exif",
            latitude: 51.5007,
            longitude: -0.1246,
            neighborhood: "Westminster",
            city: "London",
            region: "England",
            country: "United Kingdom",
            countryCode: "GB",
            formatted: "1 Example Street, London",
          },
        },
      },
      select: { id: true },
    });
    itemId = item.id;
    await write.room.create({
      data: {
        userId,
        name: "Trips",
        slug: "trips",
        type: "manual",
        visibility: "public",
        roomItems: { create: { itemId } },
      },
    });
  });

  const PRECISE = /51\.5007|-0\.1246|Westminster|Example Street/;
  const precise = {
    latitude: 51.5007,
    longitude: -0.1246,
    neighborhood: "Westminster",
    formatted: "1 Example Street, London",
  };
  const coarse = {
    latitude: null,
    longitude: null,
    neighborhood: null,
    formatted: null,
    city: "London",
    region: "England",
    country: "United Kingdom",
    countryCode: "GB",
  };

  test("the public item page", async () => {
    const { loadPublicItem, toClientItem } = await import(
      "@/app/(public)/[username]/items/[id]/_lib/public-item"
    );
    const loaded = await loadPublicItem({
      rawUsername: "@traveller",
      id: itemId,
    });
    if (!loaded) throw new Error("shared item should load");

    const visitor = toClientItem(loaded.item, { isOwner: false });
    expect(visitor.locations).toEqual([expect.objectContaining(coarse)]);
    expect(JSON.stringify(visitor)).not.toMatch(PRECISE);

    const owner = toClientItem(loaded.item, { isOwner: true });
    expect(owner.locations).toEqual([expect.objectContaining(precise)]);
  });

  test("public room grids", async () => {
    const { read } = await import("@/lib/db");
    const { roomItemSelect, toClientRoomItem } = await import(
      "@/lib/rooms/room-item-query"
    );
    const rows = await read.roomItem.findMany({ select: roomItemSelect });

    const visitor = rows.map((row) =>
      toClientRoomItem(row, { isOwner: false }),
    );
    expect(visitor.map((item) => item.locations)).toEqual([
      [expect.objectContaining(coarse)],
    ]);
    expect(JSON.stringify(visitor)).not.toMatch(PRECISE);

    const owner = rows.map((row) => toClientRoomItem(row, { isOwner: true }));
    expect(owner.map((item) => item.locations)).toEqual([
      [expect.objectContaining(precise)],
    ]);
  });
});
