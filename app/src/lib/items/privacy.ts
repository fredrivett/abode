/**
 * An item's privacy level — a ladder where each level adds restrictions to the
 * one before it:
 *
 * - `standard`: can appear in public rooms and be shared by direct link
 * - `unlisted`: kept out of public rooms; can still be shared by direct link
 * - `sensitive`: owner-only (a share link is paused, not cleared), blurred
 *   wherever it shows, and opening it needs the owner's password
 */

import type { ItemPrivacy, Prisma } from "@prisma/client";

/** Neutral name shown for a sensitive item wherever its title would leak it. */
export const SENSITIVE_ITEM_LABEL = "Sensitive item";

/** `code` on the 403 for a sensitive item requested before it's unlocked. */
export const SENSITIVE_LOCKED_CODE = "sensitive_locked";

/** Every level, least to most restrictive (matches the Postgres enum order). */
export const ITEM_PRIVACY_LEVELS = [
  "standard",
  "unlisted",
  "sensitive",
] as const satisfies readonly ItemPrivacy[];

export function isItemPrivacy(value: unknown): value is ItemPrivacy {
  return ITEM_PRIVACY_LEVELS.some((level) => level === value);
}

/** The more restrictive of two levels — defaults can only tighten, never loosen. */
export function stricterPrivacy({
  current,
  candidate,
}: {
  current: ItemPrivacy;
  candidate: ItemPrivacy;
}): ItemPrivacy {
  return ITEM_PRIVACY_LEVELS.indexOf(candidate) >
    ITEM_PRIVACY_LEVELS.indexOf(current)
    ? candidate
    : current;
}

/** Whether an item at this level may appear in (and be viewed via) a public room. */
export function allowsPublicRooms(privacy: ItemPrivacy): boolean {
  return privacy === "standard";
}

/** Whether a direct share link to an item at this level may be followed. */
export function allowsShareLink(privacy: ItemPrivacy): boolean {
  return privacy !== "sensitive";
}

/** Whether the owner must re-enter their password to open an item at this level. */
export function isSensitive(privacy: ItemPrivacy): boolean {
  return privacy === "sensitive";
}

/** Prisma `where` fragment for {@link allowsPublicRooms}. */
export const publicRoomEligibleWhere = {
  privacy: "standard",
} satisfies Prisma.ItemWhereInput;

/** Prisma `where` fragment for {@link allowsShareLink}. */
export const shareLinkEligibleWhere = {
  privacy: { not: "sensitive" },
} satisfies Prisma.ItemWhereInput;
