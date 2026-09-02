import { describe, expect, it } from "vitest";
import { stepFromCap } from "./living-gallery";

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
