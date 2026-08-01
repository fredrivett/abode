/**
 * Minimal, share-safe data fetchers for the public OG images.
 *
 * OG images are rendered for anonymous crawlers at share time, so these
 * deliberately fetch ONLY public/shared content — never gated on a viewer.
 * They mirror the visibility rules the public pages enforce (`canViewItem`,
 * public rooms only) but select just the handful of fields a card needs.
 */

import { cache } from "react";
import db from "@/lib/db";
import { canViewItem } from "@/lib/items/access";

/** Strip the required `@` prefix from a route username, or return null. */
export function parseOgUsername(rawUsername: string): string | null {
  const decoded = decodeURIComponent(rawUsername);
  if (!decoded.startsWith("@")) return null;
  return decoded.slice(1);
}

export type OgProfile = {
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  itemCount: number;
  roomCount: number;
};

/** Profiles are public. Returns display fields plus public stat counts. */
export const getOgProfile = cache(
  async (username: string): Promise<OgProfile | null> => {
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
    if (!user) return null;

    const [roomCount, itemCount] = await Promise.all([
      db.room.count({
        where: { userId: user.id, visibility: "public", slug: { not: null } },
      }),
      // Items visible on the public profile = items in the user's public rooms
      // and not excluded from public rooms.
      db.item.count({
        where: {
          userId: user.id,
          excludeFromPublicRooms: false,
          roomItems: { some: { room: { visibility: "public" } } },
        },
      }),
    ]);

    return {
      // username matched the where clause, so it's non-null; coalesce for TS.
      username: user.username ?? username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      itemCount,
      roomCount,
    };
  },
);

export type OgRoom = {
  name: string;
  emoji: string | null;
  itemCount: number;
  ownerUsername: string;
};

/** Only PUBLIC rooms get a real OG card. */
export const getOgRoom = cache(
  async (username: string, slug: string): Promise<OgRoom | null> => {
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });
    if (!user) return null;

    const room = await db.room.findFirst({
      where: {
        userId: user.id,
        slug: { equals: slug, mode: "insensitive" },
      },
      select: {
        name: true,
        emoji: true,
        visibility: true,
        _count: { select: { roomItems: true } },
      },
    });
    // Share-time render is anonymous: private/unlisted rooms fall back.
    if (!room || room.visibility !== "public") return null;

    return {
      name: room.name,
      emoji: room.emoji,
      itemCount: room._count.roomItems,
      ownerUsername: user.username ?? username,
    };
  },
);

export type OgItem = {
  title: string | null;
  kind: string;
  coverFileKey: string | null;
  fileKey: string | null;
  ownerUsername: string;
};

/** Only publicly viewable (shared or in a public room) items get a real card. */
export const getOgItem = cache(
  async (username: string, id: string): Promise<OgItem | null> => {
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });
    if (!user) return null;

    const item = await db.item.findUnique({
      where: { id },
      select: {
        title: true,
        kind: true,
        coverFileKey: true,
        fileKey: true,
        userId: true,
        sharedAt: true,
        excludeFromPublicRooms: true,
        roomItems: { select: { room: { select: { visibility: true } } } },
      },
    });
    if (!item || item.userId !== user.id) return null;

    // Anonymous viewer: renders a real card only for shared/public items.
    if (!canViewItem(item, null)) return null;

    return {
      title: item.title,
      kind: item.kind ?? "",
      coverFileKey: item.coverFileKey,
      fileKey: item.fileKey,
      ownerUsername: user.username ?? username,
    };
  },
);
