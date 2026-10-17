import { cache } from "react";
import db from "@/lib/db";
import { publicRoomItemsWhere } from "@/lib/rooms/room-access";
import {
  ROOM_THUMBNAIL_LIMIT,
  roomThumbnailItemSelect,
  roomThumbnailItemWhere,
} from "@/lib/rooms/room-thumbnails";

/**
 * A user's public rooms as shown on their profile: newest first, with the
 * count of items a visitor can see and the latest thumbnail candidates.
 */
export const listPublicRooms = cache(async (userId: string) => {
  return db.room.findMany({
    where: {
      userId,
      visibility: "public",
      slug: { not: null },
    },
    select: {
      id: true,
      name: true,
      emoji: true,
      slug: true,
      type: true,
      _count: {
        select: { roomItems: { where: publicRoomItemsWhere } },
      },
      roomItems: {
        where: { item: roomThumbnailItemWhere },
        orderBy: { addedAt: "desc" },
        take: ROOM_THUMBNAIL_LIMIT,
        select: { item: { select: roomThumbnailItemSelect } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
});
