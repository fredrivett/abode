import type { Prisma } from "@prisma/client";
import { FILTER_TYPES, type Filter, serializeFilter } from "@/lib/search/types";
import type {
  ExportItemRow,
  ExportNoteDraftRow,
  ExportProfileRow,
  ExportRoomRow,
} from "./select";

/** Identifies the archive format; bump `EXPORT_FORMAT_VERSION` on breaking changes */
export const EXPORT_FORMAT = "abode-export";
export const EXPORT_FORMAT_VERSION = 1;

// Item.meta keys worth keeping: what the file was, not how we render it
const EXPORTED_META_KEYS = [
  "originalName",
  "type",
  "size",
  "width",
  "height",
  "duration",
  "pageCount",
  "originalUrl",
  "importSource",
  "importSourceId",
] as const;

// Storage paths and render-only placeholders inside JSON blobs (tweet/Instagram
// media, product images): internal, and meaningless outside this instance
const INTERNAL_JSON_KEY = /filekey$|^blurDataUrl$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonObject = (
  value: Prisma.JsonValue | null,
): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A JSON blob with storage keys and blur placeholders removed, however nested */
export function withoutStorageInternals(
  value: Prisma.JsonValue,
): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(withoutStorageInternals);
  if (!isJsonObject(value)) return value;
  const out: Prisma.JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (INTERNAL_JSON_KEY.test(key) || child === undefined) continue;
    out[key] = withoutStorageInternals(child);
  }
  return out;
}

function exportedMeta(meta: Prisma.JsonValue | null): Prisma.JsonObject | null {
  if (!isJsonObject(meta)) return null;
  const out: Prisma.JsonObject = {};
  for (const key of EXPORTED_META_KEYS) {
    const value = meta[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function isFilter(value: unknown): value is Filter {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    value.type in FILTER_TYPES &&
    typeof value.value === "string"
  );
}

/**
 * A smart room's filters in the same `@type:value` form as the search box, so
 * they read naturally and can be pasted back into abode's search.
 */
export function roomFilterStrings(filters: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(filters)) return [];
  return filters.filter(isFilter).map((filter) =>
    serializeFilter({
      ...filter,
      negated: filter.negated === true,
    }),
  );
}

export function toExportProfile(profile: ExportProfileRow) {
  return profile;
}

export function toExportNoteDraft(draft: ExportNoteDraftRow | null) {
  return draft?.content.trim() ? draft : null;
}

export function toExportRoom(room: ExportRoomRow) {
  const { roomItems, filters, ...rest } = room;
  return {
    ...rest,
    // Smart rooms: the filters that define membership. `items` is then a
    // snapshot of what matched at export time.
    filters: room.type === "smart" ? roomFilterStrings(filters) : null,
    items: roomItems.map(({ itemId, addedAt }) => ({ itemId, addedAt })),
  };
}

export type ExportRoom = ReturnType<typeof toExportRoom>;

export function toExportItem(item: ExportItemRow) {
  const {
    tags,
    meta,
    externalLinks,
    twitterDetails,
    instagramDetails,
    productDetails,
    imageDetails,
    articleDetails,
    bookDetails,
    noteDetails,
    videoDetails,
    documentPages,
    ...rest
  } = item;

  return {
    ...rest,
    aiTags: tags,
    meta: exportedMeta(meta),
    externalLinks: Array.isArray(externalLinks) ? externalLinks : [],
    article: articleDetails,
    book: bookDetails,
    note: noteDetails,
    video: videoDetails,
    image: imageDetails && {
      ...imageDetails,
      colors:
        imageDetails.colors && withoutStorageInternals(imageDetails.colors),
    },
    twitter: twitterDetails && {
      ...twitterDetails,
      media:
        twitterDetails.media && withoutStorageInternals(twitterDetails.media),
      card: twitterDetails.card && withoutStorageInternals(twitterDetails.card),
    },
    instagram: instagramDetails && {
      ...instagramDetails,
      media:
        instagramDetails.media &&
        withoutStorageInternals(instagramDetails.media),
    },
    product: productDetails && {
      ...productDetails,
      images:
        productDetails.images && withoutStorageInternals(productDetails.images),
    },
    document: documentPages.length > 0 ? { pages: documentPages } : null,
  };
}

export type ExportItem = ReturnType<typeof toExportItem>;
