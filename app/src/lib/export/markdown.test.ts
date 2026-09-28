import { describe, expect, it } from "vitest";
import { bookDetails, itemRow } from "./__tests__/fixtures";
import { itemToMarkdown, markdownPath, toFrontmatter } from "./markdown";
import { toExportItem } from "./serialize";

const item = (overrides: Parameters<typeof itemRow>[0] = {}) =>
  toExportItem(itemRow(overrides));

describe("toFrontmatter", () => {
  it("writes JSON-quoted YAML and drops empty values", () => {
    expect(
      toFrontmatter({
        title: 'He said "hi": a story',
        tags: ["a", "b"],
        empty: [],
        none: null,
        blank: "",
        rating: 4.5,
        read: true,
        added: new Date("2026-01-02T03:04:05.000Z"),
      }),
    ).toBe(
      [
        "---",
        'title: "He said \\"hi\\": a story"',
        'tags: ["a","b"]',
        "rating: 4.5",
        "read: true",
        'added: "2026-01-02T03:04:05.000Z"',
        "---",
        "",
      ].join("\n"),
    );
  });
});

describe("markdownPath", () => {
  it("files by kind and added date with a slug and id prefix", () => {
    expect(markdownPath(item({ title: "Hello, World!" }))).toBe(
      "items/webpage/2026-03-04-hello-world-0f8fad5b.md",
    );
  });

  it("falls back to the source URL, then 'untitled', and 'other' for no kind", () => {
    expect(markdownPath(item({ title: null, kind: null }))).toBe(
      "items/other/2026-03-04-https-example-com-post-0f8fad5b.md",
    );
    expect(
      markdownPath(item({ title: null, sourceUrl: null, kind: "image" })),
    ).toBe("items/image/2026-03-04-untitled-0f8fad5b.md");
  });

  it("keeps slugs to a sane length", () => {
    const path = markdownPath(item({ title: "word ".repeat(40) }));
    expect(path.length).toBeLessThan(110);
    expect(path).not.toMatch(/--/);
  });
});

describe("itemToMarkdown", () => {
  it("renders a note with its title restored as the heading", () => {
    const { content } = itemToMarkdown(
      item({
        kind: "note",
        title: "Groceries",
        sourceUrl: null,
        noteDetails: { content: "- milk\n- eggs" },
      }),
      [],
    );
    expect(content).toContain('kind: "note"');
    expect(content).toContain("# Groceries\n\n- milk\n- eggs");
  });

  it("renders an article with rooms, tags, notes and highlights", () => {
    const { content } = itemToMarkdown(
      item({
        kind: "article",
        userTags: ["essays"],
        tags: ["writing"],
        notes: "Re-read this",
        articleDetails: {
          author: "Paul Graham",
          domain: "paulgraham.com",
          publishedAt: null,
          readingTime: 12,
          content: "Intro.\n\n[[TWEET:123]]\n\nOutro.",
          readAt: new Date("2026-03-05T00:00:00.000Z"),
          scrollProgress: 1,
          progressUpdatedAt: null,
        },
        highlights: [
          {
            id: "h1",
            startOffset: 0,
            endOffset: 6,
            text: "Intro.\nSecond line",
            note: "key idea",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "h2",
            startOffset: 10,
            endOffset: 16,
            text: "Outro.",
            note: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
      ["Reading list"],
    );

    expect(content).toContain('rooms: ["Reading list"]');
    expect(content).toContain('tags: ["essays"]');
    expect(content).toContain('ai_tags: ["writing"]');
    expect(content).toContain('author: "Paul Graham"');
    expect(content).toContain("read: true");
    expect(content).toContain("https://x.com/i/status/123");
    expect(content).not.toContain("[[TWEET:");
    expect(content).toContain("## Notes\n\nRe-read this");
    expect(content).toContain(
      "## Highlights\n\n> Intro.\n> Second line\n\nkey idea\n\n---\n\n> Outro.",
    );
  });

  it("shows book ratings out of 5 and document pages by number", () => {
    const book = itemToMarkdown(
      item({
        kind: "book",
        bookDetails: bookDetails({
          rating: 9,
          status: "read",
          review: "Loved it",
        }),
      }),
      [],
    ).content;
    expect(book).toContain("rating: 4.5");
    expect(book).toContain('status: "read"');
    expect(book).toContain("## Review\n\nLoved it");

    const doc = itemToMarkdown(
      item({
        kind: "document",
        documentPages: [
          {
            position: 0,
            filter: "bw",
            width: 1,
            height: 1,
            ocrText: "Page one",
          },
          { position: 1, filter: "bw", width: 1, height: 1, ocrText: null },
        ],
      }),
      [],
    ).content;
    expect(doc).toContain("## Page 1\n\nPage one");
    expect(doc).not.toContain("## Page 2");
  });
});
