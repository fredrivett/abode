"use client";

import { useCallback } from "react";
import { useRootFontSize } from "@/hooks/use-root-font-size";
import type { MasonryGeometry } from "@/lib/masonry/layout";
import type { Item } from "@/lib/types/item";
import type { FrameAspect } from "./card-aspect";
import { getCardFrame } from "./card-frame";
import { measureCardText } from "./card-text-measurer";

/**
 * `getFrame` for a `MasonryGrid` of items: sizes each card with
 * {@link getCardFrame} against the grid's measured column width and the live
 * font sizes. `fontScale` is the grid's card font scale (density).
 */
export function useCardFrame(
  fontScale = 1,
): (item: Item, geometry: MasonryGeometry) => FrameAspect {
  // Card root font size: gridCardStyle sets font-size to
  // calc(var(--grid-font-scale) * 1rem), so 1em on a card is fontScale × the
  // live root rem (not a hard-coded 16px — respects the user's font-size pref)
  const rootRemPx = useRootFontSize();
  return useCallback(
    (item, { columnWidth }) =>
      getCardFrame(item, {
        columnWidth,
        rootRemPx,
        cardRootPx: fontScale * rootRemPx,
        measure: measureCardText,
      }),
    [fontScale, rootRemPx],
  );
}
