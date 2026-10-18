import type { Item } from "@/lib/types/item";
import { isSensitive } from "./privacy";

/**
 * Fields a sensitive item keeps in list views (grid, search, rooms): enough to
 * place a blurred tile — its kind, its slot on the timeline, its masonry
 * aspect ratio and its LQIP — and nothing about what it is.
 */
type ListSafeKey =
  | "id"
  | "kind"
  | "processingStatus"
  | "createdAt"
  | "addedAt"
  | "blurDataUrl"
  | "privacy";

// Every other Item field, made required so a field added to Item fails to
// compile here until it's either redacted below or deliberately listed as safe
type RedactedFields = { [K in Exclude<keyof Item, ListSafeKey>]-?: Item[K] };

// What a tile may keep of `meta`: the dimensions the masonry grid sizes it
// from (a book's cover is stored separately) and the upload-time LQIP the
// tile blurs before analysis has stored one
const LAYOUT_META_NUMBERS = [
  "width",
  "height",
  "coverWidth",
  "coverHeight",
] as const;

function layoutMeta(meta: Item["meta"]): Item["meta"] {
  if (!meta) return null;
  const kept: Record<string, unknown> = {};
  for (const key of LAYOUT_META_NUMBERS) {
    if (typeof meta[key] === "number") kept[key] = meta[key];
  }
  if (
    typeof meta.blurDataUrl === "string" &&
    meta.blurDataUrl.startsWith("data:image/")
  ) {
    kept.blurDataUrl = meta.blurDataUrl;
  }
  return Object.keys(kept).length > 0 ? kept : null;
}

function redactedFields(item: Item): RedactedFields {
  return {
    redacted: true,
    processingError: null,
    fileKey: null,
    coverFileKey: null,
    faviconFileKey: null,
    sourceFileKey: null,
    meta: layoutMeta(item.meta),
    sourceType: null,
    sourceUrl: null,
    captureSource: null,
    title: null,
    description: null,
    tags: [],
    userTags: [],
    notes: null,
    objects: [],
    colors: [],
    ocrText: null,
    captureDate: null,
    locations: [],
    articleDetails: null,
    twitterDetails: null,
    instagramDetails: null,
    videoDetails: null,
    productDetails: null,
    bookDetails: null,
    noteDetails: null,
    coverHidden: false,
    sharedAt: null,
    sharedHighlights: false,
    rooms: [],
    externalLinks: [],
  };
}

/**
 * Strip a sensitive item down to a blurred-tile placeholder for list views.
 * Its content is only served by the item endpoint once the owner has unlocked
 * sensitive items with their password. Non-sensitive items pass through.
 *
 * Caller-specific extras on `T` (a search match, room membership) pass through
 * untouched; every `Item` field is redacted unless it's in {@link ListSafeKey}.
 */
export function redactSensitiveItem<T extends Item>(item: T): T {
  if (!item.privacy || !isSensitive(item.privacy)) return item;
  return { ...item, ...redactedFields(item) };
}
