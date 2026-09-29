import { itemDisplayTitle } from "./markdown";
import type { ExportItem } from "./serialize";

export type BookmarkEntry = {
  url: string;
  title: string;
  addedAt: Date;
  tags: string[];
  description: string | null;
};

export type BookmarkFolder = {
  name: string;
  createdAt: Date;
  itemIds: string[];
};

function isWebUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** The bookmark for an item saved from a web URL; null for uploads, notes, scans */
export function toBookmarkEntry(item: ExportItem): BookmarkEntry | null {
  if (!isWebUrl(item.sourceUrl)) return null;
  return {
    url: item.sourceUrl,
    title: itemDisplayTitle(item),
    addedAt: item.addedAt,
    tags: item.userTags,
    description: item.notes?.trim() || item.description?.trim() || null,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const unixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

function bookmarkLines(entry: BookmarkEntry, indent: string): string[] {
  const tags = entry.tags.length
    ? ` TAGS="${escapeHtml(entry.tags.join(","))}"`
    : "";
  const lines = [
    `${indent}<DT><A HREF="${escapeHtml(entry.url)}" ADD_DATE="${unixSeconds(entry.addedAt)}"${tags}>${escapeHtml(entry.title)}</A>`,
  ];
  if (entry.description) {
    // Bookmark descriptions are single-line in every importer
    lines.push(
      `${indent}<DD>${escapeHtml(entry.description.replace(/\s+/g, " "))}`,
    );
  }
  return lines;
}

/**
 * Every saved web link as a Netscape bookmark file — the format every browser
 * and bookmarking service (Raindrop, Pinboard, Linkding, …) imports. Links sit
 * in an "abode" folder, with a sub-folder per room holding that room's links.
 */
export function buildBookmarksHtml({
  entries,
  folders,
  exportedAt,
}: {
  entries: Map<string, BookmarkEntry>;
  folders: BookmarkFolder[];
  exportedAt: Date;
}): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    `    <DT><H3 ADD_DATE="${unixSeconds(exportedAt)}">abode</H3>`,
    "    <DL><p>",
  ];

  for (const folder of folders) {
    const folderEntries = folder.itemIds
      .map((id) => entries.get(id))
      .filter((entry): entry is BookmarkEntry => entry !== undefined);
    if (folderEntries.length === 0) continue;
    lines.push(
      `        <DT><H3 ADD_DATE="${unixSeconds(folder.createdAt)}">${escapeHtml(folder.name)}</H3>`,
      "        <DL><p>",
      ...folderEntries.flatMap((entry) => bookmarkLines(entry, "            ")),
      "        </DL><p>",
    );
  }
  for (const entry of entries.values()) {
    lines.push(...bookmarkLines(entry, "        "));
  }

  lines.push("    </DL><p>", "</DL><p>", "");
  return lines.join("\n");
}
