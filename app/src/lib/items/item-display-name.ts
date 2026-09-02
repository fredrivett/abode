import { noteDisplayName } from "@/lib/items/note-title";
import type { Item } from "@/lib/types/item";

/**
 * The display name shown for an item — used for the grid card, the detail
 * dialog, and the document title, so they stay consistent.
 *
 * `item.title` is the single source of truth; the fallbacks cover items whose
 * title hasn't resolved yet: a processing URL shows its domain, a title-less
 * note shows its first line, and everything else shows "Untitled".
 */
export function getItemDisplayName(item: Item): string {
  const isProcessingUrl =
    item.sourceType === "url" && item.processingStatus === "processing";

  if (isProcessingUrl && !item.title && item.sourceUrl) {
    try {
      return new URL(item.sourceUrl).hostname;
    } catch {
      return "Processing URL";
    }
  }

  if (item.kind === "note" && !item.title) {
    return noteDisplayName(item.noteDetails?.content ?? "") ?? "Untitled";
  }

  return item.title ?? "Untitled";
}
