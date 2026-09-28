import db from "@/lib/db";
import {
  ITEM_TIMELINE_ORDER_BY,
  itemTimelineCursor,
  itemTimelineCursorWhere,
} from "@/lib/items/query";
import type { CursorData } from "@/lib/pagination";
import { ArchiveWriter } from "./archive";
import {
  type BookmarkEntry,
  buildBookmarksHtml,
  toBookmarkEntry,
} from "./bookmarks";
import { type BookRow, buildBooksCsv, toBookRow } from "./books-csv";
import { itemToMarkdown } from "./markdown";
import { buildExportReadme } from "./readme";
import {
  exportItemSelect,
  exportNoteDraftSelect,
  exportProfileSelect,
  exportRoomSelect,
} from "./select";
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  toExportItem,
  toExportNoteDraft,
  toExportProfile,
  toExportRoom,
} from "./serialize";

// Items per query. Article bodies can be long, so keep batches modest.
const ITEM_BATCH_SIZE = 100;

// Nest each pretty-printed item inside the top-level "items" array
const indentItem = (json: string) => `    ${json.replace(/\n/g, "\n    ")}`;

/**
 * Builds a user's data export as a ZIP: `abode.json` (the complete copy),
 * one Markdown file per item, `bookmarks.html`, `books.csv` and a README.
 * Items are read in timeline order in batches and streamed into `abode.json`
 * as they're read, so the JSON is never held as one giant string.
 */
export async function buildExportArchive({
  userId,
  exportedAt,
  instanceUrl,
}: {
  userId: string;
  exportedAt: Date;
  instanceUrl: string;
}): Promise<{ bytes: Uint8Array; itemCount: number }> {
  const [profile, noteDraft, roomRows] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: exportProfileSelect,
    }),
    db.noteDraft.findUnique({
      where: { userId },
      select: exportNoteDraftSelect,
    }),
    db.room.findMany({
      where: { userId },
      select: exportRoomSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const rooms = roomRows.map(toExportRoom);

  const roomNamesByItem = new Map<string, string[]>();
  for (const room of rooms) {
    for (const { itemId } of room.items) {
      roomNamesByItem.set(itemId, [
        ...(roomNamesByItem.get(itemId) ?? []),
        room.name,
      ]);
    }
  }

  const archive = new ArchiveWriter(exportedAt);
  const json = archive.openFile("abode.json");
  const header = JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      exportedAt,
      instance: instanceUrl,
      profile: toExportProfile(profile),
      noteDraft: toExportNoteDraft(noteDraft),
      rooms,
    },
    null,
    2,
  );
  // Reopen the header object (drop its closing "\n}") to append "items"
  json.write(`${header.slice(0, -2)},\n  "items": [`);

  const bookmarks = new Map<string, BookmarkEntry>();
  const books: BookRow[] = [];
  const markdownPaths = new Set<string>();
  let itemCount = 0;
  let cursor: CursorData | null = null;

  for (;;) {
    const batch = await db.item.findMany({
      where: cursor
        ? { AND: [{ userId }, itemTimelineCursorWhere(cursor)] }
        : { userId },
      orderBy: ITEM_TIMELINE_ORDER_BY,
      take: ITEM_BATCH_SIZE,
      select: exportItemSelect,
    });

    for (const row of batch) {
      const item = toExportItem(row);
      json.write(
        `${itemCount === 0 ? "\n" : ",\n"}${indentItem(JSON.stringify(item, null, 2))}`,
      );

      const markdown = itemToMarkdown(item, roomNamesByItem.get(item.id) ?? []);
      // Paths carry an id prefix, but never let a collision overwrite a file
      const path = markdownPaths.has(markdown.path)
        ? markdown.path.replace(/\.md$/, `-${item.id}.md`)
        : markdown.path;
      markdownPaths.add(path);
      archive.addFile(path, markdown.content);

      const bookmark = toBookmarkEntry(item);
      if (bookmark) bookmarks.set(item.id, bookmark);
      const book = toBookRow(item);
      if (book) books.push(book);
      itemCount += 1;
    }

    const last = batch.at(-1);
    if (!last || batch.length < ITEM_BATCH_SIZE) break;
    cursor = itemTimelineCursor(last);
  }

  json.write(itemCount === 0 ? "]\n}\n" : "\n  ]\n}\n");
  json.end();

  archive.addFile(
    "bookmarks.html",
    buildBookmarksHtml({
      entries: bookmarks,
      folders: rooms.map((room) => ({
        name: room.emoji ? `${room.emoji} ${room.name}` : room.name,
        createdAt: room.createdAt,
        itemIds: room.items.map(({ itemId }) => itemId),
      })),
      exportedAt,
    }),
  );
  archive.addFile("books.csv", buildBooksCsv(books));
  archive.addFile(
    "README.md",
    buildExportReadme({
      exportedAt,
      instanceUrl,
      itemCount,
      roomCount: rooms.length,
      bookCount: books.length,
      bookmarkCount: bookmarks.size,
    }),
  );

  return { bytes: archive.finish(), itemCount };
}
