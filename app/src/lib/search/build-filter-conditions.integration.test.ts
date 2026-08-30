/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { buildFilterConditions, type ParsedFilters } from "./query-builder";

/**
 * Proves the SQL that `buildFilterConditions` composes actually executes
 * against Postgres for both aliases it's used with: `"i"` (the ranked search
 * queries, `FROM items i`) and `"items"` (the filters-only query, unaliased
 * `FROM items`). This is the path that had no integration coverage before the
 * two builders were unified.
 */
describe("buildFilterConditions integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async (email: string) => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: { id: crypto.randomUUID(), email },
    });
  };

  const createItem = async (
    userId: string,
    data: {
      kind?: "image" | "article";
      tags?: string[];
      sourceType?: "upload" | "url";
    },
  ): Promise<string> => {
    const { write } = await import("@/lib/db");
    const item = await write.item.create({
      data: { id: crypto.randomUUID(), userId, ...data },
    });
    return item.id;
  };

  /** Run the composed WHERE against a real query for the given alias. */
  const runQuery = async (
    userId: string,
    filters: ParsedFilters,
    alias: "i" | "items",
  ): Promise<string[]> => {
    const { write } = await import("@/lib/db");
    const { conditions, params } = buildFilterConditions(userId, filters, {
      alias,
    });
    const from = alias === "i" ? "items i" : "items";
    const select = alias === "i" ? "i.id" : "items.id";
    const sql = `SELECT ${select} AS id FROM ${from} WHERE ${conditions.join(" AND ")}`;
    const rows = await write.$queryRawUnsafe<Array<{ id: string }>>(
      sql,
      ...params,
    );
    return rows.map((r) => r.id).sort();
  };

  test.each(["i", "items"] as const)(
    "filters by type/tag/source under the %s alias",
    async (alias) => {
      const user = await createUser(`${alias}@example.com`);
      const redImage = await createItem(user.id, {
        kind: "image",
        tags: ["red"],
        sourceType: "upload",
      });
      const blueArticle = await createItem(user.id, {
        kind: "article",
        tags: ["blue"],
        sourceType: "url",
      });

      // Type filter
      expect(await runQuery(user.id, { type: [t("image")] }, alias)).toEqual([
        redImage,
      ]);
      // Tag filter
      expect(await runQuery(user.id, { tag: [t("blue")] }, alias)).toEqual([
        blueArticle,
      ]);
      // Source filter
      expect(await runQuery(user.id, { source: [t("upload")] }, alias)).toEqual(
        [redImage],
      );
      // No filters → both items, scoped to the user
      expect((await runQuery(user.id, {}, alias)).sort()).toEqual(
        [redImage, blueArticle].sort(),
      );
    },
  );

  test("scopes to the requesting user under both aliases", async () => {
    const owner = await createUser("owner@example.com");
    const other = await createUser("other@example.com");
    const mine = await createItem(owner.id, { kind: "image" });
    await createItem(other.id, { kind: "image" });

    expect(await runQuery(owner.id, { type: [t("image")] }, "i")).toEqual([
      mine,
    ]);
    expect(await runQuery(owner.id, { type: [t("image")] }, "items")).toEqual([
      mine,
    ]);
  });
});

/** Build a non-negated filter value. */
function t(value: string) {
  return { value, negated: false };
}
