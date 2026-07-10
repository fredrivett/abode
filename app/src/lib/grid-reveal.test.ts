import { describe, expect, it } from "vitest";
import {
  getRevealDelay,
  REVEAL_BATCH_SIZE,
  REVEAL_MAX_STEPS,
  REVEAL_STAGGER_STEP,
} from "@/lib/grid-reveal";

describe("getRevealDelay", () => {
  it("gives the first item no delay", () => {
    expect(getRevealDelay(0)).toBe(0);
  });

  it("staggers early items by a fixed step", () => {
    expect(getRevealDelay(1)).toBeCloseTo(REVEAL_STAGGER_STEP);
    expect(getRevealDelay(3)).toBeCloseTo(3 * REVEAL_STAGGER_STEP);
  });

  it("caps the delay so the tail of a batch never waits too long", () => {
    const capped = REVEAL_MAX_STEPS * REVEAL_STAGGER_STEP;
    expect(getRevealDelay(REVEAL_MAX_STEPS + 5)).toBeCloseTo(capped);
    expect(getRevealDelay(REVEAL_MAX_STEPS)).toBeCloseTo(capped);
  });

  it("resets the cascade at each page batch boundary", () => {
    // First item of the second batch behaves like the first item of the first
    expect(getRevealDelay(REVEAL_BATCH_SIZE)).toBe(0);
    expect(getRevealDelay(REVEAL_BATCH_SIZE + 1)).toBeCloseTo(
      REVEAL_STAGGER_STEP,
    );
  });

  it("handles negative or non-finite indices safely", () => {
    expect(getRevealDelay(-1)).toBe(0);
    expect(getRevealDelay(Number.NaN)).toBe(0);
    expect(getRevealDelay(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
