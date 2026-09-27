import type { Prisma, RoomVisibility } from "@prisma/client";

/**
 * Whether `viewerId` (null for a signed-out visitor) may view a room: its
 * owner always, anyone else only while it's public.
 */
export function canViewRoom({
  room,
  viewerId,
}: {
  room: { userId: string; visibility: RoomVisibility };
  viewerId: string | null;
}): boolean {
  return room.visibility === "public" || room.userId === viewerId;
}

/**
 * Which of a room's items a viewer sees. Non-owners only get items that are
 * publicly viewable in it: one opted out of public rooms
 * (`excludeFromPublicRooms`) isn't viewable per `canViewItem`, so it must not
 * appear — otherwise its now-public reading data leaks. Shared by the room
 * page and its Load more API so pagination can't widen what a page shows.
 */
export function viewableRoomItemsWhere({
  roomId,
  isOwner,
}: {
  roomId: string;
  isOwner: boolean;
}): Prisma.RoomItemWhereInput {
  return isOwner
    ? { roomId }
    : { roomId, item: { excludeFromPublicRooms: false } };
}
