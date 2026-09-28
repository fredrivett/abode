import { describe, expect, it } from "vitest";
import { GALLERY_CARDS } from "./gallery-data";
import {
  CHOREOGRAPHY_MEDIA_QUERY,
  distributeToColumns,
  stepFromCap,
} from "./living-gallery";

// Capture-phase constants mirrored from the component under test.
const SCOOT_FRAC = 0.22;
const STEP_COUNT = 3;
const BAND = (1 - SCOOT_FRAC) / STEP_COUNT;

describe("stepFromCap", () => {
  it("stays on the first step with no progress while the wall is still scooting", () => {
    expect(stepFromCap(0)).toEqual({ index: 0, progress: 0 });
    expect(stepFromCap(SCOOT_FRAC)).toEqual({ index: 0, progress: 0 });
  });

  it("reports progress through the active step's band", () => {
    const midStep0 = stepFromCap(SCOOT_FRAC + BAND * 0.5);
    expect(midStep0.index).toBe(0);
    expect(midStep0.progress).toBeCloseTo(0.5, 5);
  });

  it("advances the index at each band boundary and resets progress", () => {
    expect(stepFromCap(SCOOT_FRAC + BAND).index).toBe(1);
    expect(stepFromCap(SCOOT_FRAC + BAND).progress).toBeCloseTo(0, 5);
    expect(stepFromCap(SCOOT_FRAC + BAND * 2).index).toBe(2);
  });

  it("clamps to the last step and fills progress to 1 at the end", () => {
    const end = stepFromCap(1);
    expect(end.index).toBe(STEP_COUNT - 1);
    expect(end.progress).toBeCloseTo(1, 5);
  });
});

describe("CHOREOGRAPHY_MEDIA_QUERY", () => {
  // The wall + capture column only fit side by side above this width; below it
  // they collide, so narrow viewports must fall back to the static grid.
  it("requires a wide viewport", () => {
    expect(CHOREOGRAPHY_MEDIA_QUERY).toContain("(min-width: 1024px)");
  });

  // Width measures the available room directly, so the gate stays orientation-
  // agnostic — a roomy tablet qualifies whichever way it's held.
  it("does not gate on orientation", () => {
    expect(CHOREOGRAPHY_MEDIA_QUERY).not.toContain("orientation");
  });
});

describe("distributeToColumns", () => {
  // Replaces CSS `columns` (which WebKit mis-paints) with a deterministic split,
  // so every card must land in exactly one column and the counts must be stable.
  for (const count of [2, 3]) {
    it(`splits every card across ${count} columns exactly once`, () => {
      const columns = distributeToColumns(GALLERY_CARDS, count);
      expect(columns).toHaveLength(count);
      const indices = columns.flat().sort((a, b) => a - b);
      expect(indices).toEqual(GALLERY_CARDS.map((_, i) => i));
    });
  }

  it("is deterministic — server and client render the same split", () => {
    expect(distributeToColumns(GALLERY_CARDS, 3)).toEqual(
      distributeToColumns(GALLERY_CARDS, 3),
    );
  });

  it("fills columns before the last is empty (no wasted column)", () => {
    const columns = distributeToColumns(GALLERY_CARDS, 3);
    expect(columns.every((c) => c.length > 0)).toBe(true);
  });
});
