import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import db from "@/lib/db";
import { listItemFiles } from "@/lib/item-storage";
import {
  ITEM_TIMELINE_ORDER_BY,
  itemTimelineCursor,
  itemTimelineCursorWhere,
} from "@/lib/items/query";
import type { CursorData } from "@/lib/pagination";
import { type ArchivePart, PartedArchiveWriter } from "./archive";
import {
  type BookmarkEntry,
  buildBookmarksHtml,
  toBookmarkEntry,
} from "./bookmarks";
import { type BookRow, buildBooksCsv, toBookRow } from "./books-csv";
import { exportFolderName } from "./constants";
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
  exportFilePath,
  toExportItem,
  toExportNoteDraft,
  toExportProfile,
  toExportRoom,
  uploadedAvatarKey,
} from "./serialize";

// Items per query. Article bodies can be long, so keep batches modest.
const ITEM_BATCH_SIZE = 100;

// Files downloaded at once while copying them in: enough to hide latency,
// few enough (at up to 15 MB each) to keep memory small
const DOWNLOAD_CONCURRENCY = 6;

// Nest each pretty-printed item inside the top-level "items" array
const indentItem = (json: string) => `    ${json.replace(/\n/g, "\n    ")}`;

/** A stored file to copy into the archive */
export type ExportFileSource = { bucket: "items" | "avatars"; key: string };

type QueuedFile = ExportFileSource & { path: string };

export type BuildExportResult = {
  parts: ArchivePart[];
  itemCount: number;
  fileCount: number;
  missingFileCount: number;
};

/**
 * Builds a user's data export as one or more ZIP parts on disk, handing each
 * finished part to `onPart` (to upload and delete it):
 *
 * 1. Data: a README, `abode.json` (the complete copy), `bookmarks.html`,
 *    `books.csv` and one Markdown file per item. Items are read in timeline
 *    order in batches; `abode.json` and the Markdown are staged on disk as
 *    they're read, then added, so part 1 always opens with the README and
 *    `abode.json`.
 * 2. Files: every stored file of every item (plus an uploaded avatar) under
 *    `files/<itemId>/<name>`, where abode.json and the Markdown point. A file
 *    that can't be downloaded is listed in `missing-files.txt` rather than
 *    failing the export.
 *
 * Parts roll over at `maxPartBytes` (see PartedArchiveWriter).
 */
export async function buildExportArchive({
  userId,
  exportedAt,
  instanceUrl,
  workDir,
  maxPartBytes,
  downloadFile,
  onPart,
}: {
  userId: string;
  exportedAt: Date;
  instanceUrl: string;
  /** Empty directory for parts in progress */
  workDir: string;
  maxPartBytes: number;
  /** A stored file's bytes, or null if it can't be fetched */
  downloadFile: (file: ExportFileSource) => Promise<Uint8Array | null>;
  onPart: (part: ArchivePart) => Promise<void>;
}): Promise<BuildExportResult> {
  const [profileRow, noteDraft, roomRows] = await Promise.all([
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
  const profile = toExportProfile(profileRow);

  const queue: QueuedFile[] = [];
  const avatarKey = uploadedAvatarKey(profileRow);
  if (avatarKey && profile.avatarFile) {
    queue.push({ bucket: "avatars", key: avatarKey, path: profile.avatarFile });
  }

  const roomNamesByItem = new Map<string, string[]>();
  for (const room of rooms) {
    for (const { itemId } of room.items) {
      roomNamesByItem.set(itemId, [
        ...(roomNamesByItem.get(itemId) ?? []),
        room.name,
      ]);
    }
  }

  // Text is staged on local disk first, so the archive never holds a file
  // open while items are read and can split parts at any file boundary
  const textDir = join(workDir, "text");
  await mkdir(textDir, { recursive: true });
  const jsonPath = join(textDir, "abode.json");
  const jsonOut = createWriteStream(jsonPath);
  // Surface a disk error as a rejection runDataExport's cleanup can handle,
  // never as an unhandled 'error' event that takes down the worker
  const jsonDone = new Promise<void>((resolve, reject) => {
    jsonOut.once("finish", resolve);
    jsonOut.once("error", reject);
  });
  jsonDone.catch(() => {});
  const writeJson = async (text: string) => {
    if (!jsonOut.write(text)) {
      await Promise.race([once(jsonOut, "drain"), jsonDone]);
    }
  };

  const header = JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      exportedAt,
      instance: instanceUrl,
      profile,
      noteDraft: toExportNoteDraft(noteDraft),
      rooms,
    },
    null,
    2,
  );
  // Reopen the header object (drop its closing "\n}") to append "items"
  await writeJson(`${header.slice(0, -2)},\n  "items": [`);

  const bookmarks = new Map<string, BookmarkEntry>();
  const books: BookRow[] = [];
  const markdownPaths: string[] = [];
  const seenMarkdownPaths = new Set<string>();
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
      await writeJson(
        `${itemCount === 0 ? "\n" : ",\n"}${indentItem(JSON.stringify(item, null, 2))}`,
      );

      for (const { key, name } of listItemFiles(row)) {
        queue.push({
          bucket: "items",
          key,
          path: exportFilePath({ itemId: row.id, name }),
        });
      }

      const markdown = itemToMarkdown(item, roomNamesByItem.get(item.id) ?? []);
      // Paths carry an id prefix, but never let a collision overwrite a file
      const path = seenMarkdownPaths.has(markdown.path)
        ? markdown.path.replace(/\.md$/, `-${item.id}.md`)
        : markdown.path;
      seenMarkdownPaths.add(path);
      markdownPaths.push(path);
      await mkdir(dirname(join(textDir, path)), { recursive: true });
      await writeFile(join(textDir, path), markdown.content);

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

  jsonOut.end(itemCount === 0 ? "]\n}\n" : "\n  ]\n}\n");
  await jsonDone;

  // Part 1 opens with the README and the complete copy; then everything else
  const archive = new PartedArchiveWriter({
    dir: workDir,
    modifiedAt: exportedAt,
    maxPartBytes,
    folderForPart: (position) => exportFolderName({ exportedAt, position }),
    onPart,
  });
  await archive.addText(
    "README.md",
    buildExportReadme({
      exportedAt,
      instanceUrl,
      itemCount,
      roomCount: rooms.length,
      bookCount: books.length,
      bookmarkCount: bookmarks.size,
      fileCount: queue.length,
    }),
  );
  await archive.addTextFromDisk("abode.json", jsonPath);
  await archive.addText(
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
  await archive.addText("books.csv", buildBooksCsv(books));
  for (const path of markdownPaths) {
    await archive.addTextFromDisk(path, join(textDir, path));
  }

  const missing: string[] = [];
  for (let i = 0; i < queue.length; i += DOWNLOAD_CONCURRENCY) {
    const batch = queue.slice(i, i + DOWNLOAD_CONCURRENCY);
    const downloads = await Promise.all(
      batch.map(({ bucket, key }) => downloadFile({ bucket, key })),
    );
    for (const [index, file] of batch.entries()) {
      const data = downloads[index];
      if (data) {
        await archive.addBinary(file.path, data);
      } else {
        missing.push(file.path);
      }
    }
  }
  if (missing.length > 0) {
    await archive.addText(
      "missing-files.txt",
      `These files couldn't be copied into the export. Everything else about them is in abode.json.\n\n${missing.join("\n")}\n`,
    );
  }

  return {
    parts: await archive.finish(),
    itemCount,
    fileCount: queue.length - missing.length,
    missingFileCount: missing.length,
  };
}
