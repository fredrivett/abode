/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

vi.mock("@/lib/user", () => ({ getAuthenticatedUser: async () => null }));

// Visitors get city-level locations only: exact coordinates, neighborhood and
// the formatted street address never leave the server on public pages
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
    expect(toClientItem(loaded.item).locations).toEqual([
      expect.objectContaining(coarse),
    ]);
    // Never even fetched
    expect(JSON.stringify(loaded.item)).not.toMatch(
      /51\.5007|Westminster|Example Street/,
    );
  });

  test("public room grids", async () => {
    const { read } = await import("@/lib/db");
    const { roomItemSelect, toClientRoomItem } = await import(
      "@/lib/rooms/room-item-query"
    );
    const rows = await read.roomItem.findMany({ select: roomItemSelect });
    expect(rows.map(toClientRoomItem).map((item) => item.locations)).toEqual([
      [expect.objectContaining(coarse)],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(
      /51\.5007|Westminster|Example Street/,
    );
  });
});
