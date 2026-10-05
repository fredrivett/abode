import { describe, expect, it } from "vitest";
import { itemRow } from "./__tests__/fixtures";
import { buildBookmarksHtml, toBookmarkEntry } from "./bookmarks";
import { toExportItem } from "./serialize";

describe("toBookmarkEntry", () => {
  it("only makes bookmarks for web links", () => {
    const entry = (sourceUrl: string | null) =>
      toBookmarkEntry(toExportItem(itemRow({ sourceUrl })));
    expect(entry("https://example.com/a")?.url).toBe("https://example.com/a");
    expect(entry("http://example.com/a")).not.toBeNull();
    expect(entry(null)).toBeNull();
    expect(entry("javascript:alert(1)")).toBeNull();
    expect(entry("not a url")).toBeNull();
  });

  it("prefers the user's notes over the captured description", () => {
    const withNotes = toExportItem(
      itemRow({ notes: "mine", description: "theirs" }),
    );
    expect(toBookmarkEntry(withNotes)?.description).toBe("mine");
  });
});

describe("buildBookmarksHtml", () => {
  const entry = {
    url: "https://example.com/?a=1&b=2",
    title: 'Tom & "Jerry" <3',
    addedAt: new Date("2026-01-01T00:00:00.000Z"),
    tags: ["x", "y"],
    description: "line one\nline two",
  };

  it("writes a Netscape bookmark file with escaped links, tags and dates", () => {
    const html = buildBookmarksHtml({
      entries: new Map([["item-1", entry]]),
      folders: [],
      exportedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(html.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")).toBe(true);
    expect(html).toContain(
      '<DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1767225600" TAGS="x,y">Tom &amp; &quot;Jerry&quot; &lt;3</A>',
    );
    expect(html).toContain("<DD>line one line two");
  });

  it("adds a folder per room holding its links, skipping rooms without any", () => {
    const html = buildBookmarksHtml({
      entries: new Map([["item-1", entry]]),
      folders: [
        { name: "🎨 Design", createdAt: new Date(0), itemIds: ["item-1"] },
        { name: "Notes only", createdAt: new Date(0), itemIds: ["note-1"] },
      ],
      exportedAt: new Date(0),
    });

    expect(html).toContain('<H3 ADD_DATE="0">🎨 Design</H3>');
    expect(html).not.toContain("Notes only");
    // In its room folder and in the main list
    expect(html.match(/HREF=/g)).toHaveLength(2);
  });
});
