/**
 * Access control for viewing items outside of an explicit room context.
 */

import type { ItemPrivacy, Prisma, RoomVisibility } from "@prisma/client";
import {
  allowsPublicRooms,
  allowsShareLink,
  publicRoomEligibleWhere,
  shareLinkEligibleWhere,
} from "./privacy";

/**
 * Prisma select fragment with the minimal fields needed to decide item
 * viewability. Spread into a larger select so every call site stays consistent.
 */
export const itemAccessSelect = {
  userId: true,
  sharedAt: true,
  privacy: true,
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
  privacy: ItemPrivacy;
  roomItems: { room: { visibility: RoomVisibility } }[];
};

/**
 * Whether `viewerId` may view this item.
 *
 * Three independent grants:
 * 1. The owner can always view it.
 * 2. It has been directly shared via link (`sharedAt` is set) and isn't
 *    sensitive — a sensitive item's link is paused, not cleared.
 * 3. It lives in at least one public room and its privacy level allows public
 *    rooms (`standard`).
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
    (item.sharedAt !== null && allowsShareLink(item.privacy)) ||
    (inPublicRoom && allowsPublicRooms(item.privacy))
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
  const sharedGrant: Prisma.ItemWhereInput = {
    sharedAt: { not: null },
    ...shareLinkEligibleWhere,
  };
  const publicRoomGrant: Prisma.ItemWhereInput = {
    ...publicRoomEligibleWhere,
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
