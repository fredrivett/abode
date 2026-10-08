import { getBookTileFrame } from "@/lib/book-cover";
import { tweetPreviewText } from "@/lib/twitter/preview-text";
import type { Item } from "@/lib/types/item";
import {
  estimateNoteAspect,
  estimateTweetAspect,
  type FrameAspect,
  type TextMeasurer,
} from "./card-aspect";
import { readAspectHint } from "./provisional-aspect";

export type CardFrameContext = {
  /** Rendered column width (px) — text cards size their height against it */
  columnWidth: number;
  /** Document root font size (px) */
  rootRemPx: number;
  /** Card root font size (px): the grid font scale × `rootRemPx` */
  cardRootPx: number;
  measure: TextMeasurer;
};

type Dimensions = { width?: number | null; height?: number | null };

/** Just the dimensions of media that has both, else null */
function dimensionsOf(value: Dimensions | undefined): FrameAspect | null {
  return value?.width && value?.height
    ? { width: value.width, height: value.height }
    : null;
}

function metaNumber(meta: Item["meta"], key: string): number | undefined {
  const value = meta?.[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * A grid card's frame (only width:height matters) for any item kind — the
 * one sizing rule every masonry grid uses, so an item is the same shape on
 * the dashboard, in a room, and in a room preview.
 */
export function getCardFrame(
  item: Item,
  { columnWidth, rootRemPx, cardRootPx, measure }: CardFrameContext,
): FrameAspect {
  const meta = item.meta ?? {};
  switch (item.kind) {
    case "twitter": {
      const details = item.twitterDetails;
      const coverIndex = details?.coverMediaIndex ?? 0;
      const cover = details?.media?.[coverIndex] ?? details?.media?.[0];
      const coverFrame = dimensionsOf(cover);
      if (coverFrame) return coverFrame;
      // Twitter link-card images render at ~1.91:1
      if (details?.card?.imageUrl) return { width: 16, height: 9 };
      // Text-only tweet: height follows the tweet text
      const previewText = details && tweetPreviewText(details);
      if (details && previewText) {
        return estimateTweetAspect(
          { text: previewText, hasAvatar: !!details.authorAvatarUrl },
          { columnWidthPx: columnWidth, rootRemPx, measure },
        );
      }
      return { width: 16, height: 12 };
    }
    case "instagram": {
      const details = item.instagramDetails;
      const coverIndex = details?.coverMediaIndex ?? 0;
      const cover = details?.media?.[coverIndex] ?? details?.media?.[0];
      // OG covers carry no dimensions; Instagram posts are ~square
      return dimensionsOf(cover) ?? { width: 1, height: 1 };
    }
    case "video":
      // New videos persist thumbnail dims into meta; older ones fall back to 16:9
      return {
        width: metaNumber(meta, "width") ?? 16,
        height: metaNumber(meta, "height") ?? 9,
      };
    case "product": {
      const details = item.productDetails;
      const cover = details?.images?.[details.coverImageIndex ?? 0];
      // Most product photography is squarish to portrait
      return dimensionsOf(cover) ?? { width: 1, height: 1 };
    }
    case "book":
      // Cover's ingested aspect ratio plus equal padding all round
      return getBookTileFrame(item.meta);
    case "article":
    case "webpage":
      return { width: 4, height: 3 };
    case "note":
      // Coverless text card: height follows the note's content
      return estimateNoteAspect(
        { title: item.title, body: item.noteDetails?.content ?? "" },
        { columnWidthPx: columnWidth, cardRootPx, rootRemPx, measure },
      );
    default: {
      // A URL whose kind hasn't resolved yet (processing or failed): the
      // insert-time hint (video/twitter) when present, so the card lands at
      // its final shape; otherwise 4:3
      if (item.sourceType === "url" && item.kind === null) {
        const hint = readAspectHint(meta);
        return hint ?? { width: 4, height: 3 };
      }
      // Images: their dimensions, or 3:4
      return {
        width: metaNumber(meta, "width") ?? 3,
        height: metaNumber(meta, "height") ?? 4,
      };
    }
  }
}
