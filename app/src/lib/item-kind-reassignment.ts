import type { ItemKind } from "@prisma/client";

/**
 * User-facing item-kind reassignment.
 *
 * An item's kind is normally *derived* from its source (see classify-item-kind).
 * But the "which kind of web page is this" decision (article vs generic webpage
 * vs product vs book) is a judgement call over the same fetched HTML, and the
 * heuristic sometimes gets it wrong. This module defines which kinds a user may
 * manually switch between and is the single source of truth for both the UI
 * (whether to show the picker, and with what options) and the API (validating a
 * requested override).
 *
 * Source-locked kinds — twitter, video, image, note — are deliberately absent:
 * the source *is* the kind (a tweet URL, a YouTube URL, an uploaded image, a
 * composed note) and its detail data can't be re-derived as any other kind.
 */

/**
 * Kinds a reassignment can target. All four are derived by fetching a generic
 * HTML page and inferring what it is, so any is a valid re-interpretation of
 * another. `classifyItemKind` can force any of these from page HTML.
 */
export const FORCIBLE_KINDS = [
  "webpage",
  "article",
  "product",
  "book",
] as const satisfies readonly ItemKind[];

export type ForcibleKind = (typeof FORCIBLE_KINDS)[number];

export function isForcibleKind(
  kind: string | null | undefined,
): kind is ForcibleKind {
  return kind != null && (FORCIBLE_KINDS as readonly string[]).includes(kind);
}

/**
 * For a given current kind, the kinds a user may switch it to. Web-family kinds
 * map to their siblings; everything else is locked (empty list = no picker).
 * Expanding what's reassignable is a matter of editing this map.
 */
export const REASSIGNABLE_TARGETS: Record<ItemKind, readonly ForcibleKind[]> = {
  webpage: ["article", "product", "book"],
  article: ["webpage", "product", "book"],
  product: ["webpage", "article", "book"],
  book: ["webpage", "article", "product"],
  image: [],
  twitter: [],
  video: [],
  note: [],
};

/** The kinds a user may switch `kind` to (excludes the current kind). */
export function reassignableTargets(
  kind: ItemKind | null,
): readonly ForcibleKind[] {
  return kind === null ? [] : REASSIGNABLE_TARGETS[kind];
}

/** Whether `to` is a permitted manual reassignment from `from`. */
export function canReassignKind(from: ItemKind | null, to: ItemKind): boolean {
  return reassignableTargets(from).includes(to as ForcibleKind);
}

/** Human-readable labels for item kinds (raw enum values aren't all display-ready). */
export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  webpage: "Web page",
  article: "Article",
  product: "Product",
  book: "Book",
  image: "Image",
  twitter: "Post",
  video: "Video",
  note: "Note",
};
