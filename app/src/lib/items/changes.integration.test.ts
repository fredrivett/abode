/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { DbTransactionClient } from "@/lib/db";
import {
  type ChangesCursor,
  decodeChangesCursor,
  listItemChanges,
  listItemIds,
} from "./changes";

/**
 * The offline library syncs whatever `items.updated_at` says changed, so every
 * write the app shows for an item must move it: the database triggers from
 * the offline_sync_updated_at migration. Edits to the owner's own rows run
 * under the restricted abode_app role, as the routes' do, to show the triggers
 * work under row level security.
 */
describe("item changes", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  // Far enough ahead that a finished round's cursor is where it got to, not
  // the reread window, so each step sees only what changed since the last
  const LATER = Date.now() + 60 * 60 * 1000;

  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  const db = async () => (await import("@/lib/db")).write;

  const createUser = async (email: string, username: string) =>
    (await db()).user.create({
      data: { id: crypto.randomUUID(), email, username },
    });

  const createItem = async (userId: string, title: string) =>
    (await db()).item.create({ data: { userId, kind: "webpage", title } });

  const asOwner = async <T>(
    ownerId: string,
    run: (tx: DbTransactionClient) => Promise<T>,
  ) => {
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { systemDb } = await import("@/lib/db");
    return viewerTransaction({ base: systemDb, viewerId: ownerId, run });
  };

  /** Every change after `after`, paged two at a time as a sync would */
  async function drain(userId: string, after: ChangesCursor | null) {
    let cursor = after;
    const ids: string[] = [];
    let page: Awaited<ReturnType<typeof listItemChanges>>;
    do {
      page = await listItemChanges({
        userId,
        after: cursor,
        limit: 2,
        now: LATER,
      });
      ids.push(...page.items.map((item) => item.id));
      cursor = decodeChangesCursor(page.cursor);
    } while (page.hasMore);
    return { ids, cursor, total: page.total };
  }

  test("every write an item shows moves it into the changes, and only that item", async () => {
    const user = await createUser("owner@example.com", "owner");
    const item = await createItem(user.id, "Changed");
    const bystander = await createItem(user.id, "Untouched");
    let { cursor } = await drain(user.id, null);

    const changedBy = async (write: () => Promise<unknown>) => {
      await tick();
      await write();
      const next = await drain(user.id, cursor);
      cursor = next.cursor;
      return next.ids;
    };

    const w = await db();
    // A manual location, saved by its owner under row level security
    expect(
      await changedBy(() =>
        asOwner(user.id, (tx) =>
          tx.itemLocation.create({
            data: {
              itemId: item.id,
              userId: user.id,
              source: "manual",
              city: "Leeds",
            },
          }),
        ),
      ),
    ).toEqual([item.id]);
    // Enrichment writing image details (as a Trigger task does, via the owner)
    expect(
      await changedBy(() =>
        w.itemImageDetails.create({
          data: { itemId: item.id, objects: ["chair"] },
        }),
      ),
    ).toEqual([item.id]);
    expect(
      await changedBy(() =>
        w.itemImageDetails.update({
          where: { itemId: item.id },
          data: { objects: ["chair", "lamp"] },
        }),
      ),
    ).toEqual([item.id]);

    const room = await w.room.create({
      data: {
        userId: user.id,
        name: "Kitchen",
        slug: "kitchen",
        type: "manual",
      },
    });
    expect(
      await changedBy(() =>
        w.roomItem.create({ data: { roomId: room.id, itemId: item.id } }),
      ),
    ).toEqual([item.id]);
    // The item shows its rooms' names and their owner's username
    expect(
      await changedBy(() =>
        w.room.update({ where: { id: room.id }, data: { name: "Galley" } }),
      ),
    ).toEqual([item.id]);
    expect(
      await changedBy(() =>
        w.user.update({
          where: { id: user.id },
          data: { username: "renamed" },
        }),
      ),
    ).toEqual([item.id]);
    // A room write that changes nothing an item shows doesn't resend it
    expect(
      await changedBy(() =>
        w.room.update({
          where: { id: room.id },
          data: { visibility: "public" },
        }),
      ),
    ).toEqual([]);
    expect(
      await changedBy(() =>
        w.roomItem.deleteMany({ where: { roomId: room.id, itemId: item.id } }),
      ),
    ).toEqual([item.id]);
    // Raw SQL writes count too, not only Prisma's
    expect(
      await changedBy(
        () =>
          w.$executeRaw`UPDATE items SET title = 'Raw' WHERE id = ${item.id}::uuid`,
      ),
    ).toEqual([item.id]);

    expect(bystander.id).not.toBe(item.id);
  });

  test("the database's clock wins over the updatedAt Prisma sends", async () => {
    const user = await createUser("clock@example.com", "clock");
    const item = await createItem(user.id, "Clock");
    const updated = await (await db()).item.update({
      where: { id: item.id },
      data: { title: "Later", updatedAt: new Date(0) },
    });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      item.createdAt.getTime() - 1,
    );
  });

  test("pages through items sharing one timestamp without skipping or repeating, scoped to the user", async () => {
    const user = await createUser("pages@example.com", "pages");
    const other = await createUser("other@example.com", "other");
    const w = await db();
    // One transaction: every row gets the same now()
    await w.$transaction(
      ["a", "b", "c", "d", "e"].map((title) =>
        w.item.create({ data: { userId: user.id, kind: "webpage", title } }),
      ),
    );
    const otherItem = await createItem(other.id, "Not yours");

    const { ids, total } = await drain(user.id, null);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids).not.toContain(otherItem.id);
    expect(total).toBe(5);

    expect((await listItemIds(user.id)).sort()).toEqual([...ids].sort());
  });

  test("returns slim cards: no article body", async () => {
    const user = await createUser("slim@example.com", "slim");
    const item = await createItem(user.id, "Article");
    await (await db()).itemArticleDetails.create({
      data: { itemId: item.id, content: "A very long body" },
    });
    const { items } = await listItemChanges({
      userId: user.id,
      after: null,
      limit: 10,
    });
    expect(items[0].articleDetails?.content).toBeNull();
  });
});
