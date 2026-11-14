/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { DbTransactionClient } from "@/lib/db";
import { createNote } from "@/lib/items/create-note";
import { fullTextSearch } from "./full-text-search";

/**
 * A note's body (item_note_details) and an item's manual tags feed the item's
 * search vector, kept current by database triggers. Edits run as the owner
 * under the restricted abode_app role, as the item PATCH route's do, so the
 * triggers are shown to work under row level security.
 */
describe("fullTextSearch over note bodies and manual tags", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: { id: crypto.randomUUID(), email: "search@example.com" },
    });
  };

  const asOwner = async <T>(
    ownerId: string,
    run: (tx: DbTransactionClient) => Promise<T>,
  ) => {
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { systemDb } = await import("@/lib/db");
    return viewerTransaction({ base: systemDb, viewerId: ownerId, run });
  };

  const search = async (userId: string, query: string) =>
    (await fullTextSearch(userId, {}, query)).map((result) => result.id);

  test("finds a note by its body, and follows edits to it", async () => {
    const user = await createUser();
    const note = await createNote(user.id, {
      title: "Weekend plans",
      content: "Pick up a sourdough starter at the farmers market.",
      source: "web",
    });
    // An item that matches the title alone, to show the body narrows the match
    const { write } = await import("@/lib/db");
    await write.item.create({
      data: { userId: user.id, kind: "webpage", title: "Weekend reading" },
    });

    expect(await search(user.id, "sourdough")).toEqual([note.id]);
    // Title and body words in one query: every word must match the same item
    expect(await search(user.id, "weekend sourdough")).toEqual([note.id]);

    await asOwner(user.id, (tx) =>
      tx.itemNoteDetails.update({
        where: { itemId: note.id },
        data: { content: "Call Grandma about Sunday lunch." },
      }),
    );
    expect(await search(user.id, "sourdough")).toEqual([]);
    expect(await search(user.id, "grandma")).toEqual([note.id]);

    // A title edit rebuilds the vector without dropping the body
    await asOwner(user.id, (tx) =>
      tx.item.update({ where: { id: note.id }, data: { title: "Errands" } }),
    );
    expect(await search(user.id, "errands grandma")).toEqual([note.id]);
  });

  test("finds an item by a manual tag until the tag is removed", async () => {
    const user = await createUser();
    const { write } = await import("@/lib/db");
    const item = await write.item.create({
      data: {
        userId: user.id,
        kind: "webpage",
        title: "Balcony ideas",
        tags: ["plants"],
      },
    });
    expect(await search(user.id, "gardening")).toEqual([]);

    await asOwner(user.id, (tx) =>
      tx.item.update({
        where: { id: item.id },
        data: { userTags: ["gardening"] },
      }),
    );
    expect(await search(user.id, "gardening")).toEqual([item.id]);

    await asOwner(user.id, (tx) =>
      tx.item.update({ where: { id: item.id }, data: { userTags: [] } }),
    );
    expect(await search(user.id, "gardening")).toEqual([]);
    // Auto tags are untouched
    expect(await search(user.id, "plants")).toEqual([item.id]);
  });
});
