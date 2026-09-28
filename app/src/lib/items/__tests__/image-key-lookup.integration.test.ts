/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { collectItemFileKeys, itemFileKeysSelect } from "@/lib/item-storage";
import { findItemOwningImageKey } from "@/lib/items/image-key-lookup";
import { fileKeyStrings, unpopulatedSelections } from "./file-key-strings";

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

  test("resolves every key in the file-key inventory, so the proxy serves all of an item's files", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const key = (name: string) => `${user.id}/${name}`;
    // Every location populated at once — kinds don't gate the detail rows
    const { id } = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "twitter",
        processingStatus: "completed",
        fileKey: key("file.jpg"),
        coverFileKey: key("cover.jpg"),
        faviconFileKey: key("favicon.png"),
        productDetails: {
          create: {
            images: [{ fileKey: key("product.jpg"), url: "https://shop/1" }],
          },
        },
        twitterDetails: {
          create: {
            tweetId: "1",
            authorUsername: "someone",
            authorAvatarFileKey: key("avatar.jpg"),
            media: [
              { type: "photo", url: "https://x/1", fileKey: key("tweet.jpg") },
            ],
            card: { url: "https://ex.com", imageFileKey: key("card.jpg") },
          },
        },
        instagramDetails: {
          create: {
            postId: "p",
            mediaType: "post",
            authorUsername: "someone",
            media: [
              { type: "image", url: "https://ig/1", fileKey: key("ig.jpg") },
            ],
          },
        },
        documentPages: {
          create: {
            position: 0,
            fileKey: key("page.jpg"),
            originalFileKey: key("page-colour.jpg"),
            width: 100,
            height: 140,
          },
        },
      },
      select: { id: true },
    });

    const row = await read.item.findUniqueOrThrow({
      where: { id },
      select: itemFileKeysSelect,
    });
    // The fixture must fill every location the inventory selects, or a new
    // one would silently drop out of the proxy check below
    expect(unpopulatedSelections(itemFileKeysSelect, row)).toEqual([]);
    const keys = collectItemFileKeys(row);
    expect(new Set(keys)).toEqual(fileKeyStrings(row));

    for (const fileKey of keys) {
      const found = await findItemOwningImageKey(fileKey);
      expect(found?.id, `proxy lookup for ${fileKey}`).toBe(id);
    }
  });

  test("returns null for a key no item references", async () => {
    const user = await createUser();
    expect(await findItemOwningImageKey(`${user.id}/missing.jpg`)).toBeNull();
  });
});
