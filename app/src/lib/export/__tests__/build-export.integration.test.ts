/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { strFromU8, unzipSync } from "fflate";
import { buildExportArchive } from "@/lib/export/build-export";

const EXPORTED_AT = new Date("2026-09-28T12:00:00.000Z");
const INSTANCE = "https://abode.example.com";

async function createUser(username: string | null = null) {
  const { write } = await import("@/lib/db");
  return write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `export-${crypto.randomUUID()}@example.com`,
      username,
      bio: "I save things",
    },
  });
}

async function build(userId: string) {
  const { bytes, itemCount } = await buildExportArchive({
    userId,
    exportedAt: EXPORTED_AT,
    instanceUrl: INSTANCE,
  });
  const files = Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([path, data]) => [
      path,
      strFromU8(data),
    ]),
  );
  const json = JSON.parse(files["abode.json"] ?? "null");
  return { files, json, itemCount };
}

describe("buildExportArchive", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("exports the whole library in every format", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser("reader");
    const other = await createUser();

    const article = await write.item.create({
      data: {
        userId: user.id,
        kind: "article",
        title: "How to Do Great Work",
        sourceType: "url",
        sourceUrl: "https://paulgraham.com/greatwork.html",
        userTags: ["essays"],
        tags: ["career"],
        notes: "Re-read yearly",
        fileKey: `${user.id}/cover.jpg`,
        coverFileKey: `${user.id}/cover.jpg`,
        processingStatus: "completed",
        addedAt: new Date("2026-01-02T00:00:00.000Z"),
        articleDetails: {
          create: { author: "Paul Graham", content: "Pick a field." },
        },
        locations: {
          create: {
            userId: user.id,
            source: "manual",
            formatted: "London, UK",
            raw: { secret: "provider payload" },
          },
        },
        highlights: {
          create: {
            userId: user.id,
            startOffset: 0,
            endOffset: 13,
            text: "Pick a field.",
            note: "the crux",
          },
        },
      },
    });
    const book = await write.item.create({
      data: {
        userId: user.id,
        kind: "book",
        title: "The Dispossessed",
        processingStatus: "completed",
        addedAt: new Date("2026-01-01T00:00:00.000Z"),
        bookDetails: {
          create: {
            authors: ["Ursula K. Le Guin"],
            isbn: "9780061054884",
            status: "read",
            rating: 10,
          },
        },
      },
    });
    const note = await write.item.create({
      data: {
        userId: user.id,
        kind: "note",
        title: "Ideas",
        sourceType: "compose",
        processingStatus: "completed",
        addedAt: new Date("2026-01-03T00:00:00.000Z"),
        noteDetails: { create: { content: "- export everything" } },
      },
    });
    await write.item.create({
      data: {
        userId: other.id,
        kind: "note",
        title: "Someone else's",
        processingStatus: "completed",
      },
    });

    await write.room.create({
      data: {
        userId: user.id,
        name: "Reading",
        emoji: "📚",
        type: "manual",
        roomItems: { create: [{ itemId: article.id }, { itemId: book.id }] },
      },
    });
    await write.room.create({
      data: {
        userId: user.id,
        name: "Essays",
        type: "smart",
        filters: [{ id: "f", type: "tag", value: "essays", negated: false }],
        roomItems: { create: [{ itemId: article.id }] },
      },
    });
    await write.noteDraft.create({
      data: { userId: user.id, content: "half a thought" },
    });

    const { files, json, itemCount } = await build(user.id);

    expect(itemCount).toBe(3);
    expect(Object.keys(files).sort()).toEqual(
      [
        "README.md",
        "abode.json",
        "bookmarks.html",
        "books.csv",
        "items/article/2026-01-02-how-to-do-great-work-" +
          `${article.id.slice(0, 8)}.md`,
        `items/book/2026-01-01-the-dispossessed-${book.id.slice(0, 8)}.md`,
        `items/note/2026-01-03-ideas-${note.id.slice(0, 8)}.md`,
      ].sort(),
    );

    // abode.json: header, profile, rooms, items newest-added first
    expect(json).toMatchObject({
      format: "abode-export",
      version: 1,
      exportedAt: EXPORTED_AT.toISOString(),
      instance: INSTANCE,
      profile: { email: user.email, username: "reader", bio: "I save things" },
      noteDraft: { content: "half a thought" },
    });
    expect(json.rooms).toHaveLength(2);
    expect(json.rooms[0]).toMatchObject({
      name: "Reading",
      type: "manual",
      filters: null,
    });
    expect(json.rooms[1]).toMatchObject({
      name: "Essays",
      filters: ["@tag:essays"],
      items: [{ itemId: article.id }],
    });
    expect(json.items.map((i: { id: string }) => i.id)).toEqual([
      note.id,
      article.id,
      book.id,
    ]);
    expect(json.items[1]).toMatchObject({
      title: "How to Do Great Work",
      userTags: ["essays"],
      aiTags: ["career"],
      notes: "Re-read yearly",
      article: { author: "Paul Graham", content: "Pick a field." },
      locations: [{ source: "manual", formatted: "London, UK" }],
      highlights: [{ text: "Pick a field.", note: "the crux" }],
    });

    // Nothing internal leaks: storage keys, raw payloads, pipeline state, ids
    const raw = files["abode.json"];
    expect(raw).not.toMatch(/fileKey|cover\.jpg|provider payload/);
    expect(raw).not.toMatch(/processingStatus|isAdmin|userId/);
    expect(raw).not.toContain("Someone else's");

    const articleMd =
      files[
        `items/article/2026-01-02-how-to-do-great-work-${article.id.slice(0, 8)}.md`
      ];
    expect(articleMd).toContain('rooms: ["Reading","Essays"]');
    expect(articleMd).toContain("> Pick a field.\n\nthe crux");

    expect(files["bookmarks.html"]).toContain(
      'HREF="https://paulgraham.com/greatwork.html"',
    );
    expect(files["bookmarks.html"]).toContain("📚 Reading");
    expect(files["books.csv"]).toContain("The Dispossessed,Ursula K. Le Guin");
    expect(files["README.md"]).toContain(
      "3 items, 2 rooms, 1 book, 1 saved link.",
    );
  });

  it("pages through large libraries without dropping or repeating items", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    // Several items share an addedAt so the id tiebreak is exercised
    const addedAt = new Date("2026-05-05T00:00:00.000Z");
    await write.item.createMany({
      data: Array.from({ length: 230 }, (_, i) => ({
        userId: user.id,
        kind: "note" as const,
        title: `Note ${i}`,
        processingStatus: "completed" as const,
        addedAt: i % 3 === 0 ? addedAt : new Date(addedAt.getTime() + i),
      })),
    });

    const { json, itemCount, files } = await build(user.id);

    const ids: string[] = json.items.map((i: { id: string }) => i.id);
    expect(itemCount).toBe(230);
    expect(new Set(ids).size).toBe(230);
    expect(
      Object.keys(files).filter((path) => path.startsWith("items/")),
    ).toHaveLength(230);
  });

  it("produces valid JSON for an empty library", async () => {
    const user = await createUser();
    const { json, itemCount, files } = await build(user.id);
    expect(itemCount).toBe(0);
    expect(json.items).toEqual([]);
    expect(json.rooms).toEqual([]);
    expect(files["books.csv"].split("\r\n")).toHaveLength(2);
  });
});
