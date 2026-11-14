import { noteDisplayName } from "@/lib/items/note-title";
import type { Item } from "@/lib/types/item";

/**
 * The display name shown for an item — used for the grid card, the detail
 * dialog, and the document title, so they stay consistent.
 *
 * `item.title` is the single source of truth; the fallbacks cover items with
 * no title: a URL shows its domain (still processing, failed, or saved bare
 * without enrichment), a title-less note shows its first line, and everything
 * else shows "Untitled".
 */
export function getItemDisplayName(item: Item): string {
  if (item.sourceType === "url" && !item.title && item.sourceUrl) {
    try {
      return new URL(item.sourceUrl).hostname;
    } catch {
      if (item.processingStatus === "processing") return "Processing URL";
    }
  }

  if (item.kind === "note" && !item.title) {
    return noteDisplayName(item.noteDetails?.content ?? "") ?? "Untitled";
  }

  return item.title ?? "Untitled";
}
