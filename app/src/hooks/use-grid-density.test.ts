import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DENSITY_CONFIG, LG_BREAKPOINT } from "@/stores/grid-density-store";
import { useGridDensity } from "./use-grid-density";

function stubViewport({ lg }: { lg: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: lg && query === `(min-width: ${LG_BREAKPOINT}px)`,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderedFrameWidths(): number[] {
  const widths: number[] = [];
  renderHook(() => {
    const { frameWidth } = useGridDensity({ enablePinch: false });
    widths.push(frameWidth);
  });
  return widths;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useGridDensity", () => {
  // A first render at the mobile width painted the grid small, then grew it
  it("renders the lg frame width from the first render on a desktop viewport", () => {
    stubViewport({ lg: true });
    expect(new Set(renderedFrameWidths())).toEqual(
      new Set([DENSITY_CONFIG.normal.lg.frameWidth]),
    );
  });

  it("renders the default frame width below the lg breakpoint", () => {
    stubViewport({ lg: false });
    expect(new Set(renderedFrameWidths())).toEqual(
      new Set([DENSITY_CONFIG.normal.default.frameWidth]),
    );
  });
});
