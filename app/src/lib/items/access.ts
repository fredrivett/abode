/**
 * Access control for viewing items outside of an explicit room context.
 */

import type { Prisma, RoomVisibility } from "@prisma/client";

/**
 * Prisma select fragment with the minimal fields needed to decide item
 * viewability. Spread into a larger select so every call site stays consistent.
 */
export const itemAccessSelect = {
  userId: true,
  sharedAt: true,
  excludeFromPublicRooms: true,
  roomItems: {
    select: {
      room: {
        select: {
          visibility: true,
        },
      },
    },
  },
} satisfies Prisma.ItemSelect;

/** Minimal item shape required to decide standalone viewability. */
export type ItemAccessInput = {
  userId: string;
  sharedAt: Date | null;
  excludeFromPublicRooms: boolean;
  roomItems: { room: { visibility: RoomVisibility } }[];
};

/**
 * Whether `viewerId` may view this item.
 *
 * Three independent grants:
 * 1. The owner can always view it.
 * 2. It has been directly shared via link (`sharedAt` is set).
 * 3. It lives in at least one public room and isn't excluded from public rooms.
 */
export function canViewItem(
  item: ItemAccessInput,
  viewerId: string | null,
): boolean {
  const isOwner = viewerId !== null && viewerId === item.userId;
  const inPublicRoom = item.roomItems.some(
    (ri) => ri.room.visibility === "public",
  );

  return (
    isOwner ||
    item.sharedAt !== null ||
    (inPublicRoom && !item.excludeFromPublicRooms)
  );
}

/**
 * Prisma `where` fragment encoding {@link canViewItem}'s grants, for filtering
 * items the viewer may access directly in the database. Keep in lockstep with
 * `canViewItem` — the two must agree.
 *
 * Spread alongside other conditions, e.g.
 * `where: { id, ...itemViewableWhere(viewerId) }`.
 */
export function itemViewableWhere(
  viewerId: string | null,
): Prisma.ItemWhereInput {
  const sharedGrant: Prisma.ItemWhereInput = { sharedAt: { not: null } };
  const publicRoomGrant: Prisma.ItemWhereInput = {
    excludeFromPublicRooms: false,
    roomItems: { some: { room: { visibility: "public" } } },
  };

  return {
    OR: viewerId
      ? [{ userId: viewerId }, sharedGrant, publicRoomGrant]
      : [sharedGrant, publicRoomGrant],
  };
}

/**
 * Whether the owner's highlights should be shown on a shared view of this item.
 * Owners always see their own; others only when the item opts in.
 */
export function canViewItemHighlights(
  item: { userId: string; sharedHighlights: boolean },
  viewerId: string | null,
): boolean {
  const isOwner = viewerId !== null && viewerId === item.userId;
  return isOwner || item.sharedHighlights;
}
