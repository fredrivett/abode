/**
 * Auto-generated book shelves.
 *
 * Three built-in smart rooms — Want to read / Reading / Read — materialized per
 * user once they have at least one book. They're normal private smart rooms
 * tagged with `Room.autoKind`, so the existing membership sync keeps them current
 * as book statuses change. Dismissing one records its kind in
 * `User.dismissedAutoRooms` so it's never recreated (see the room DELETE handler).
 *
 * ensureBookRooms is idempotent and never throws — it's called on the book write
 * path (import + capture) and as a safety net on rooms-list load, so a failure
 * here must never fail item capture or break the page.
 */

import { Prisma, type RoomAutoKind } from "@prisma/client";
import db from "@/lib/db";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createFilterId, type Filter } from "@/lib/search/types";
import { generateRoomSlug, syncRoomItems } from "./room-service";

const log = createLogger("lib/rooms/auto-book-rooms");

/** Emoji shown on each auto shelf. */
const SHELF_EMOJI: Record<RoomAutoKind, string> = {
  book_want_to_read: "🔖",
  book_reading: "📖",
  book_read: "✅",
};

/**
 * The three book shelves. Each maps an autoKind to the reading status it filters
 * on; the status token matches the `@status:` filter vocabulary (query-builder).
 */
export const BOOK_SHELF_DEFS: {
  autoKind: RoomAutoKind;
  status: "want_to_read" | "reading" | "read";
}[] = [
  { autoKind: "book_want_to_read", status: "want_to_read" },
  { autoKind: "book_reading", status: "reading" },
  { autoKind: "book_read", status: "read" },
];

/** Human name for a shelf, reusing the book reading-status labels. */
function shelfName(status: (typeof BOOK_SHELF_DEFS)[number]["status"]): string {
  return BOOK_READING_STATUS_LABELS[status];
}

/** Smart-room filters that select this shelf's books: type:book + status:<x>. */
function shelfFilters(
  status: (typeof BOOK_SHELF_DEFS)[number]["status"],
): Filter[] {
  return [
    { id: createFilterId(), type: "type", value: "book", negated: false },
    { id: createFilterId(), type: "status", value: status, negated: false },
  ];
}

/**
 * Create one shelf room + populate its membership. Race-safe: if a concurrent
 * ensure already created this kind (unique on [userId, autoKind]), skip quietly.
 */
async function createShelf(
  userId: string,
  def: (typeof BOOK_SHELF_DEFS)[number],
): Promise<void> {
  const name = shelfName(def.status);
  const slug = await generateRoomSlug(name, userId);

  let roomId: string;
  try {
    const room = await db.room.create({
      data: {
        userId,
        name,
        slug,
        emoji: SHELF_EMOJI[def.autoKind],
        type: "smart",
        filters: shelfFilters(def.status) as unknown as Prisma.InputJsonValue,
        visibility: "private",
        autoKind: def.autoKind,
      },
      select: { id: true },
    });
    roomId = room.id;
  } catch (error) {
    // Another concurrent ensure won the [userId, autoKind] unique race — fine.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }

  await syncRoomItems(roomId, userId);
  getPostHogClient()?.capture({
    distinctId: userId,
    event: "book_shelf_created",
    properties: { auto_kind: def.autoKind },
  });
}

/**
 * Ensure the user's book shelves exist. Creates any shelf kind that isn't already
 * present and hasn't been dismissed, but only once the user owns at least one
 * book. Idempotent and swallow-all: logged + reported on failure, never thrown.
 */
export async function ensureBookRooms(userId: string): Promise<void> {
  try {
    const [existing, user] = await Promise.all([
      db.room.findMany({
        where: { userId, autoKind: { not: null } },
        select: { autoKind: true },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: { dismissedAutoRooms: true },
      }),
    ]);
    if (!user) return;

    const present = new Set(existing.map((r) => r.autoKind));
    const dismissed = new Set(user.dismissedAutoRooms);
    const missing = BOOK_SHELF_DEFS.filter(
      (def) => !present.has(def.autoKind) && !dismissed.has(def.autoKind),
    );
    if (missing.length === 0) return;

    // Gate on being a book user — no empty shelves for people without books.
    const bookCount = await db.item.count({ where: { userId, kind: "book" } });
    if (bookCount === 0) return;

    for (const def of missing) {
      await createShelf(userId, def);
    }
  } catch (error) {
    log.warn({ error, userId }, "ensureBookRooms failed");
    captureServerException(error, userId);
  }
}
