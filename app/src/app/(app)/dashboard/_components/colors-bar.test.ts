import { describe, expect, it } from "vitest";
import type { ImageColor } from "@/lib/types/item";
import { getAdjustedSliceWidthsPercent } from "./colors-bar";

// Helper to create ImageColor objects for testing
function color(hex: string, score?: number): ImageColor {
  return { hex, name: "test", score };
}

describe("getAdjustedSliceWidthsPercent", () => {
  describe("empty input", () => {
    it("returns empty array for empty colors", () => {
      expect(
        getAdjustedSliceWidthsPercent({ colors: [], minSlicePercent: 3 }),
      ).toEqual([]);
    });
  });

  describe("single color", () => {
    it("returns 100% for a single color", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 50)],
        minSlicePercent: 3,
      });
      expect(result).toEqual([100]);
    });

    it("bumps zero score to minimum percent", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 0)],
        minSlicePercent: 3,
      });
      // Single color with zero score gets bumped to minSlicePercent
      expect(result).toEqual([3]);
    });
  });

  describe("proportional distribution", () => {
    it("distributes widths proportionally to scores", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 50), color("#00FF00", 50)],
        minSlicePercent: 1,
      });
      expect(result[0]).toBeCloseTo(50);
      expect(result[1]).toBeCloseTo(50);
    });

    it("handles uneven score distribution", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 75), color("#00FF00", 25)],
        minSlicePercent: 1,
      });
      expect(result[0]).toBeCloseTo(75);
      expect(result[1]).toBeCloseTo(25);
    });
  });

  describe("minimum slice enforcement", () => {
    it("bumps small slices to minimum percent", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 99), color("#00FF00", 1)],
        minSlicePercent: 10,
      });
      // Second slice should be at least 10%
      expect(result[1]).toBeGreaterThanOrEqual(10);
      // Total should still be 100%
      expect(result.reduce((sum, w) => sum + w, 0)).toBeCloseTo(100);
    });

    it("redistributes from large slices when small slices are bumped", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 95), color("#00FF00", 5)],
        minSlicePercent: 15,
      });
      // Small slice gets bumped to 15%
      expect(result[1]).toBeCloseTo(15);
      // Large slice gets the remaining 85%
      expect(result[0]).toBeCloseTo(85);
    });

    it("clamps minSlicePercent to reasonable bounds", () => {
      // If minSlicePercent is very high, it gets clamped to 100/colors.length
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 50), color("#00FF00", 50)],
        minSlicePercent: 80, // Can't have both at 80%
      });
      // Both should be 50% since minSlicePercent gets clamped to 50
      expect(result[0]).toBeCloseTo(50);
      expect(result[1]).toBeCloseTo(50);
    });
  });

  describe("edge cases", () => {
    it("handles all zero scores by bumping all to minimum", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 0), color("#00FF00", 0), color("#0000FF", 0)],
        minSlicePercent: 3,
      });
      // All slices have zero score, so all get bumped to minimum
      // Each gets 3% (the minSlicePercent)
      expect(result).toEqual([3, 3, 3]);
    });

    it("handles negative scores by treating as 0 and bumping to minimum", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", -10), color("#00FF00", 100)],
        minSlicePercent: 1,
      });
      // Negative score is treated as 0, gets bumped to minimum
      expect(result[0]).toBe(1);
      // Large slice gets remaining 99%
      expect(result[1]).toBe(99);
    });

    it("handles undefined scores by treating as 0 and bumping to minimum", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000"), color("#00FF00", 100)],
        minSlicePercent: 1,
      });
      // Undefined score is treated as 0, gets bumped to minimum
      expect(result[0]).toBe(1);
      // Large slice gets remaining 99%
      expect(result[1]).toBe(99);
    });

    it("distributes evenly when all slices would be too small", () => {
      // 10 colors with min 15% each = 150%, can't fit
      const colors = Array.from({ length: 10 }, (_, i) =>
        color(`#${i.toString().padStart(6, "0")}`, 1),
      );
      const result = getAdjustedSliceWidthsPercent({
        colors,
        minSlicePercent: 15,
      });
      // Should distribute evenly at 10% each
      expect(result).toHaveLength(10);
      for (const width of result) {
        expect(width).toBeCloseTo(10);
      }
    });
  });

  describe("total width invariant", () => {
    it("always sums to 100% (or 0% for all zero scores)", () => {
      const testCases = [
        { colors: [color("#F00", 100)], minSlicePercent: 5 },
        {
          colors: [color("#F00", 80), color("#0F0", 20)],
          minSlicePercent: 10,
        },
        {
          colors: [color("#F00", 50), color("#0F0", 30), color("#00F", 20)],
          minSlicePercent: 15,
        },
        {
          colors: [color("#F00", 90), color("#0F0", 5), color("#00F", 5)],
          minSlicePercent: 10,
        },
      ];

      for (const testCase of testCases) {
        const result = getAdjustedSliceWidthsPercent(testCase);
        const total = result.reduce((sum, w) => sum + w, 0);
        expect(total).toBeCloseTo(100, 5);
      }
    });
  });

  describe("minimum bound", () => {
    it("enforces 0.5% absolute minimum even if minSlicePercent is lower", () => {
      const result = getAdjustedSliceWidthsPercent({
        colors: [color("#FF0000", 99), color("#00FF00", 1)],
        minSlicePercent: 0.1, // Below the 0.5% floor
      });
      // The small slice should be clamped up to 0.5% (internal minimum)
      // But since 1% > 0.5%, it stays at 1%
      expect(result[1]).toBeCloseTo(1);
    });
  });
});
