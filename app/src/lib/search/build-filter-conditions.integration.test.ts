/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { buildFilterConditions, type ParsedFilters } from "./query-builder";

/**
 * Proves the SQL that `buildFilterConditions` composes actually executes
 * against Postgres for both aliases it's used with: `"i"` (the ranked search
 * queries, `FROM items i`) and `"items"` (the filters-only query, unaliased
 * `FROM items`). This is the path that had no integration coverage before the
 * two builders were unified.
 *
 * Every filter type is exercised under both aliases. The object/location/date/
 * color fragments embed `items.id`/`items.` table references that the builder
 * remaps onto the alias, so a broken remap would produce SQL that fails to
 * execute under one alias — which these cases catch.
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
      createdAt?: Date;
    },
  ): Promise<string> => {
    const { write } = await import("@/lib/db");
    const item = await write.item.create({
      data: { id: crypto.randomUUID(), userId, ...data },
    });
    return item.id;
  };

  const addImageDetails = async (
    itemId: string,
    data: {
      objects?: string[];
      colors?: Array<{ name: string; hex: string; score: number }>;
      captureDate?: Date;
    },
  ): Promise<void> => {
    const { write } = await import("@/lib/db");
    await write.itemImageDetails.create({ data: { itemId, ...data } });
  };

  const addLocation = async (
    itemId: string,
    userId: string,
    city: string,
  ): Promise<void> => {
    const { write } = await import("@/lib/db");
    await write.itemLocation.create({
      data: { itemId, userId, source: "manual", city },
    });
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
    "filters every type under the %s alias",
    async (alias) => {
      const user = await createUser(`${alias}@example.com`);
      const redImage = await createItem(user.id, {
        kind: "image",
        tags: ["red"],
        sourceType: "upload",
      });
      await addImageDetails(redImage, {
        objects: ["car"],
        colors: [{ name: "red", hex: "#ff0000", score: 0.9 }],
      });
      await addLocation(redImage, user.id, "paris");

      const blueArticle = await createItem(user.id, {
        kind: "article",
        tags: ["blue"],
        sourceType: "url",
      });
      await addImageDetails(blueArticle, {
        objects: ["tree"],
        colors: [{ name: "blue", hex: "#0000ff", score: 0.9 }],
      });
      await addLocation(blueArticle, user.id, "london");

      // Bare-column fragments (kind / tags / source_type)
      expect(await runQuery(user.id, { type: [t("image")] }, alias)).toEqual([
        redImage,
      ]);
      expect(await runQuery(user.id, { tag: [t("blue")] }, alias)).toEqual([
        blueArticle,
      ]);
      expect(await runQuery(user.id, { source: [t("upload")] }, alias)).toEqual(
        [redImage],
      );

      // Fragments that embed items.id / items. table references — the ones the
      // alias remap actually rewrites
      expect(await runQuery(user.id, { object: [t("car")] }, alias)).toEqual([
        redImage,
      ]);
      expect(
        await runQuery(user.id, { location: [t("london")] }, alias),
      ).toEqual([blueArticle]);
      expect(await runQuery(user.id, { color: [t("red")] }, alias)).toEqual([
        redImage,
      ]);

      // No filters → both items, scoped to the user
      expect((await runQuery(user.id, {}, alias)).sort()).toEqual(
        [redImage, blueArticle].sort(),
      );
    },
  );

  test.each(["i", "items"] as const)(
    "filters by date (COALESCE capture_date, created_at) under the %s alias",
    async (alias) => {
      const user = await createUser(`date-${alias}@example.com`);

      // Effective date comes from capture_date when present
      const past = await createItem(user.id, { kind: "image" });
      await addImageDetails(past, { captureDate: new Date("2020-01-01") });
      // Effective date falls back to created_at (now)
      const recent = await createItem(user.id, { kind: "image" });

      expect(
        await runQuery(user.id, { dateBefore: "2021-01-01" }, alias),
      ).toEqual([past]);
      expect(
        await runQuery(user.id, { dateAfter: "2021-01-01" }, alias),
      ).toEqual([recent]);
    },
  );

  test.each(["i", "items"] as const)(
    "matches quoted phrases exactly, case-insensitively, under the %s alias",
    async (alias) => {
      const { write } = await import("@/lib/db");
      const user = await createUser(`phrase-${alias}@example.com`);
      const make = (data: {
        kind?: "image" | "document";
        title?: string;
        description?: string;
        notes?: string;
        userTags?: string[];
      }) =>
        write.item
          .create({
            data: { ...data, id: crypto.randomUUID(), userId: user.id },
          })
          .then((item) => item.id);

      const inTitle = await make({
        title: "On the Equality of All Things",
      });
      const inNotes = await make({
        notes: "a line about equality of all\nthings wrapped",
      });
      const inUserTag = await make({
        userTags: ["equality of all things"],
      });
      const inOcr = await make({ kind: "image" });
      await write.itemImageDetails.create({
        data: { itemId: inOcr, ocrText: "EQUALITY OF ALL THINGS" },
      });
      const inDocPage = await make({ kind: "document" });
      await write.itemDocumentPage.create({
        data: {
          itemId: inDocPage,
          position: 2,
          fileKey: "page.jpg",
          originalFileKey: "page-original.jpg",
          width: 1,
          height: 1,
          ocrText: "…on the equality of all things…",
        },
      });
      // Every word present, but not as the phrase
      await make({
        title: "All things considered",
        description: "equality of opportunity",
      });

      expect(
        await runQuery(user.id, { phrases: ["equality of all things"] }, alias),
      ).toEqual([inTitle, inNotes, inUserTag, inOcr, inDocPage].sort());

      // Several phrases must all match
      expect(
        await runQuery(
          user.id,
          { phrases: ["equality of all things", "on the"] },
          alias,
        ),
      ).toEqual([inTitle, inDocPage].sort());

      // Regex metacharacters match literally rather than as a pattern
      const literal = await make({ title: "C++ (2nd ed.)" });
      await make({ title: "Cxx 2nd ed" });
      expect(
        await runQuery(user.id, { phrases: ["c++ (2nd ed.)"] }, alias),
      ).toEqual([literal]);
    },
  );

  test("phraseSearch returns title matches first, then newest", async () => {
    const { phraseSearch } = await import("./full-text-search");
    const user = await createUser("phrase-order@example.com");
    const { write } = await import("@/lib/db");
    const make = (data: { title?: string; notes?: string; createdAt: Date }) =>
      write.item
        .create({ data: { ...data, id: crypto.randomUUID(), userId: user.id } })
        .then((item) => item.id);

    const oldTitle = await make({
      title: "all things",
      createdAt: new Date("2020-01-01"),
    });
    const newNotes = await make({
      notes: "all things",
      createdAt: new Date("2024-01-01"),
    });
    const oldNotes = await make({
      notes: "all things",
      createdAt: new Date("2021-01-01"),
    });
    await make({ title: "things, all", createdAt: new Date("2025-01-01") });

    expect(await phraseSearch(user.id, { phrases: ["All Things"] })).toEqual([
      oldTitle,
      newNotes,
      oldNotes,
    ]);
    expect(await phraseSearch(user.id, {})).toEqual([]);
  });

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
