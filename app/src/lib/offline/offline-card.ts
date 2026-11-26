import type { Item } from "@/lib/types/item";

/** OCR text kept per item: enough to search offline, not whole scanned pages */
export const OFFLINE_OCR_TEXT_LIMIT = 2000;

/**
 * The copy of an item the offline library keeps: the item as the app shows it,
 * minus the article body and most OCR text, which can each be far larger than
 * the rest of the item. Bodies are downloaded separately, under a size budget.
 */
export function toOfflineCard(item: Item): Item {
  return {
    ...item,
    ocrText: item.ocrText?.slice(0, OFFLINE_OCR_TEXT_LIMIT) ?? null,
    articleDetails: item.articleDetails && {
      ...item.articleDetails,
      content: null,
    },
  };
}
