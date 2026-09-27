/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { findItemOwningImageKey } from "@/lib/items/image-key-lookup";

describe("findItemOwningImageKey integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `keys-${crypto.randomUUID()}@example.com`,
      },
    });
  };

  test("resolves an item by every place a re-hosted key can live on a tweet", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "twitter",
        // Cover is stored on the item itself; gallery + card keys only in JSON
        coverFileKey: `${user.id}/cover.jpg`,
        processingStatus: "completed",
        twitterDetails: {
          create: {
            tweetId: "1",
            authorUsername: "someone",
            media: [
              {
                type: "photo",
                url: "https://x/1",
                fileKey: `${user.id}/cover.jpg`,
              },
              {
                type: "photo",
                url: "https://x/2",
                fileKey: `${user.id}/second.jpg`,
              },
            ],
            card: {
              title: "t",
              url: "https://ex.com",
              imageUrl: "https://ex.com/c.jpg",
              imageFileKey: `${user.id}/card.jpg`,
            },
          },
        },
      },
      select: { id: true },
    });

    // Cover (item column), non-cover gallery photo (media JSON), card image (card JSON)
    for (const key of ["cover.jpg", "second.jpg", "card.jpg"]) {
      const found = await findItemOwningImageKey(`${user.id}/${key}`);
      expect(found?.id).toBe(item.id);
    }
  });

  test("resolves a document by any page's displayed or original key", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "document",
        fileKey: `${user.id}/page-1.jpg`,
        processingStatus: "completed",
        documentPages: {
          create: [
            {
              position: 0,
              fileKey: `${user.id}/page-1.jpg`,
              originalFileKey: `${user.id}/page-1-colour.jpg`,
              width: 100,
              height: 140,
            },
            {
              position: 1,
              fileKey: `${user.id}/page-2.jpg`,
              originalFileKey: `${user.id}/page-2-colour.jpg`,
              width: 100,
              height: 140,
            },
          ],
        },
      },
      select: { id: true },
    });

    for (const key of [
      "page-1-colour.jpg",
      "page-2.jpg",
      "page-2-colour.jpg",
    ]) {
      const found = await findItemOwningImageKey(`${user.id}/${key}`);
      expect(found?.id).toBe(item.id);
    }
    expect(await findItemOwningImageKey(`${user.id}/page-3.jpg`)).toBeNull();
  });

  test("resolves a webpage item by its re-hosted favicon key", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "webpage",
        sourceUrl: "https://example.com",
        faviconFileKey: `${user.id}/favicon.png`,
        processingStatus: "completed",
      },
      select: { id: true },
    });

    const found = await findItemOwningImageKey(`${user.id}/favicon.png`);
    expect(found?.id).toBe(item.id);
  });

  test("returns null for a key no item references", async () => {
    const user = await createUser();
    expect(await findItemOwningImageKey(`${user.id}/missing.jpg`)).toBeNull();
  });
});
