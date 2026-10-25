import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { GRID_IMAGE_FALLBACK_SIZES } from "@/lib/image-url";
import {
  MasonryCellWidthContext,
  useGridImageSizes,
} from "./masonry-cell-width";

describe("useGridImageSizes", () => {
  it("is the cell's laid-out width inside a masonry grid", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MasonryCellWidthContext value={187.5}>
        {children}
      </MasonryCellWidthContext>
    );
    const { result } = renderHook(() => useGridImageSizes(), { wrapper });
    expect(result.current).toBe("188px");
  });

  it("falls back to the full grid rendition elsewhere", () => {
    const { result } = renderHook(() => useGridImageSizes());
    expect(result.current).toBe(GRID_IMAGE_FALLBACK_SIZES);
    expect(GRID_IMAGE_FALLBACK_SIZES).toBe("800px");
  });
});
