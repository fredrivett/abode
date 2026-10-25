"use client";

import { createContext, useContext } from "react";
import { GRID_IMAGE_FALLBACK_SIZES } from "@/lib/image-url";

/** The laid-out width (px) of the masonry cell being rendered */
export const MasonryCellWidthContext = createContext<number | null>(null);

/**
 * `sizes` for an image filling its grid cell: the cell's actual width, which
 * density (60–600px columns) and screen size both change, so the browser picks
 * the smallest sufficient `srcset` candidate. Outside a masonry grid it falls
 * back to the largest candidate, as before srcsets
 */
export function useGridImageSizes(): string {
  const width = useContext(MasonryCellWidthContext);
  return width ? `${Math.ceil(width)}px` : GRID_IMAGE_FALLBACK_SIZES;
}
