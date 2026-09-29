/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetTestDatabase } from "@app/vitest.setup.db";
import { strFromU8, unzipSync } from "fflate";
import {
  buildExportArchive,
  type ExportFileSource,
} from "@/lib/export/build-export";

const EXPORTED_AT = new Date("2026-09-28T12:00:00.000Z");
const INSTANCE = "https://abode.example.com";
const BINARY = /^files\//;

async function createUser(
  username: string | null = null,
  extra: { avatarUrl?: string; avatarSource?: "upload" } = {},
) {
  const { write } = await import("@/lib/db");
  return write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `export-${crypto.randomUUID()}@example.com`,
      username,
      bio: "I save things",
      ...extra,
    },
  });
}

/**
 * Builds the export with an in-memory "storage" (`bucket:key` → bytes, absent
 * = can't be downloaded) and returns each part's entries, plus all of them
 * merged (text decoded) as they'd be after unzipping every part together.
 */
async function build(
  userId: string,
  {
    stored = {},
    maxPartBytes = 1024 * 1024 * 1024,
  }: { stored?: Record<string, Uint8Array>; maxPartBytes?: number } = {},
) {
  const workDir = await mkdtemp(join(tmpdir(), "build-export-test-"));
  const parts: Record<string, Uint8Array>[] = [];
  const requested: ExportFileSource[] = [];
  try {
    const result = await buildExportArchive({
      userId,
      exportedAt: EXPORTED_AT,
      instanceUrl: INSTANCE,
      workDir,
      maxPartBytes,
      downloadFile: async (file) => {
        requested.push(file);
        return stored[`${file.bucket}:${file.key}`] ?? null;
      },
      onPart: async (part) => {
        parts.push(unzipSync(readFileSync(part.path)));
      },
    });
    const files: Record<string, string> = {};
    const binaries: Record<string, Uint8Array> = {};
    for (const part of parts) {
      for (const [path, data] of Object.entries(part)) {
        if (BINARY.test(path)) binaries[path] = data;
        else files[path] = strFromU8(data);
      }
    }
    const json = JSON.parse(files["abode.json"] ?? "null");
    return { ...result, parts, files, binaries, json, requested };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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

    const cover = new Uint8Array([1, 2, 3]);
    const { files, binaries, json, itemCount, fileCount, parts } = await build(
      user.id,
      { stored: { [`items:${user.id}/cover.jpg`]: cover } },
    );

    expect(itemCount).toBe(3);
    expect(fileCount).toBe(1);
    expect(parts).toHaveLength(1);
    // The upload doubles as the cover (same key): copied once
    expect(binaries).toEqual({ [`files/${article.id}/original.jpg`]: cover });
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
      "3 items, 2 rooms, 1 book, 1 saved link, 1 file.",
    );
    expect(json.items[1].files).toEqual([
      { name: "original.jpg", path: `files/${article.id}/original.jpg` },
    ]);
    expect(articleMd).toContain(
      `![original.jpg](../../files/${article.id}/original.jpg)`,
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

  it("copies every stored file in, splitting parts and noting missing ones", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser(null, {
      avatarSource: "upload",
      avatarUrl:
        "https://storage.example/object/public/avatars/me/avatar.png?t=1",
    });
    const scan = await write.item.create({
      data: {
        userId: user.id,
        kind: "document",
        title: "Lease",
        processingStatus: "completed",
        fileKey: "k/p1.jpg",
        documentPages: {
          create: [
            {
              position: 0,
              fileKey: "k/p1.jpg",
              originalFileKey: "k/p1c.jpg",
              width: 1,
              height: 1,
            },
            {
              position: 1,
              fileKey: "k/p2.jpg",
              originalFileKey: "k/p2c.jpg",
              width: 1,
              height: 1,
            },
          ],
        },
      },
    });
    const kb = (fill: number) => new Uint8Array(40 * 1024).fill(fill);
    const stored = {
      "avatars:me/avatar.png": kb(9),
      "items:k/p1.jpg": kb(1),
      "items:k/p1c.jpg": kb(2),
      "items:k/p2.jpg": kb(3),
      // k/p2c.jpg is gone from storage
    };

    const result = await build(user.id, { stored, maxPartBytes: 100 * 1024 });

    expect(result.requested).toContainEqual({
      bucket: "avatars",
      key: "me/avatar.png",
    });
    expect(result.fileCount).toBe(4);
    expect(result.missingFileCount).toBe(1);
    expect(result.parts.length).toBeGreaterThan(1);
    expect(result.binaries).toEqual({
      "files/profile/avatar.png": kb(9),
      [`files/${scan.id}/page-01.jpg`]: kb(1),
      [`files/${scan.id}/page-01-original.jpg`]: kb(2),
      [`files/${scan.id}/page-02.jpg`]: kb(3),
    });
    expect(result.files["missing-files.txt"]).toContain(
      `files/${scan.id}/page-02-original.jpg`,
    );
    // Data files all land in part 1
    expect(Object.keys(result.parts[0])).toEqual(
      expect.arrayContaining(["abode.json", "README.md", "books.csv"]),
    );
    expect(result.json.profile.avatarFile).toBe("files/profile/avatar.png");
    expect(JSON.stringify(result.json)).not.toMatch(/k\/p1|fileKey/);
  });
});
