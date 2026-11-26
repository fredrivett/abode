import db from "@/lib/db";
import { itemSelect, transformItem } from "@/lib/items/query";
import { toOfflineCard } from "@/lib/offline/offline-card";
import { isCanonicalUuid } from "@/lib/pagination";

/**
 * Item changes for the offline library, in the order they happened. A sync
 * round pages through every item whose `updated_at` (set by database triggers
 * on any change the app shows) is past the cursor; the first sync has no
 * cursor, so it pages through the whole library the same way.
 */

/** Position in the changes order: `updatedAt` then `id`, both ascending */
export type ChangesCursor = { updatedAt: string; id: string };

/**
 * How far behind "now" a finished round's cursor goes. `updated_at` is stamped
 * when a transaction starts, not when it commits, so a slow transaction can
 * become visible with an `updated_at` behind rows already read; the app and
 * database clocks can also differ a little. Rereading this window each round
 * picks those up, at the cost of resending its rows.
 */
export const CHANGES_REREAD_MS = 5 * 60 * 1000;

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export function encodeChangesCursor(cursor: ChangesCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

/** Null for anything that isn't a cursor this module encoded */
export function decodeChangesCursor(raw: string): ChangesCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { updatedAt, id } = parsed as Record<string, unknown>;
  if (typeof updatedAt !== "string" || typeof id !== "string") return null;
  if (!isCanonicalUuid(id) || Number.isNaN(Date.parse(updatedAt))) return null;
  return { updatedAt, id };
}

/**
 * The cursor a finished round hands back: where it got to, but never later
 * than the reread window behind `now`, so the next round rereads that window.
 */
export function finishedRoundCursor({
  reached,
  now,
}: {
  reached: ChangesCursor | null;
  now: number;
}): ChangesCursor {
  const rereadFrom = now - CHANGES_REREAD_MS;
  if (reached && Date.parse(reached.updatedAt) <= rereadFrom) return reached;
  // The nil id sorts first, so every row stamped at rereadFrom is reread too
  return { updatedAt: new Date(rereadFrom).toISOString(), id: NIL_UUID };
}

export type ItemChangesPage = {
  items: ReturnType<typeof toOfflineCard>[];
  cursor: string;
  hasMore: boolean;
  /** How many items the user has, for the client to tell whether any were deleted */
  total: number;
};

export async function listItemChanges({
  userId,
  after,
  limit,
  now = Date.now(),
}: {
  userId: string;
  after: ChangesCursor | null;
  limit: number;
  now?: number;
}): Promise<ItemChangesPage> {
  const afterAt = after && new Date(after.updatedAt);
  const [rows, total] = await Promise.all([
    db.item.findMany({
      where: {
        userId,
        ...(after &&
          afterAt && {
            OR: [
              { updatedAt: { gt: afterAt } },
              { updatedAt: afterAt, id: { gt: after.id } },
            ],
          }),
      },
      select: itemSelect,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    }),
    db.item.count({ where: { userId } }),
  ]);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const reached = last
    ? { updatedAt: last.updatedAt.toISOString(), id: last.id }
    : after;
  const cursor =
    hasMore && reached ? reached : finishedRoundCursor({ reached, now });

  return {
    items: page.map((row) => toOfflineCard(transformItem(row))),
    cursor: encodeChangesCursor(cursor),
    hasMore,
    total,
  };
}

/** Every one of the user's item ids, for the client to drop deleted items */
export async function listItemIds(userId: string): Promise<string[]> {
  const rows = await db.item.findMany({
    where: { userId },
    select: { id: true },
  });
  return rows.map(({ id }) => id);
}
