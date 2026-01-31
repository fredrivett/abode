import { describe, expect, it } from "vitest";
import { calculateWidths } from "./colors-bar";

describe("calculateWidths", () => {
  describe("basic distribution", () => {
    it("distributes widths proportionally to scores", () => {
      const colors = [
        { hex: "#f00", name: "red", score: 0.5 },
        { hex: "#0f0", name: "green", score: 0.3 },
        { hex: "#00f", name: "blue", score: 0.2 },
      ];
      const widths = calculateWidths(colors);

      expect(widths[0]).toBeCloseTo(50);
      expect(widths[1]).toBeCloseTo(30);
      expect(widths[2]).toBeCloseTo(20);
    });

    it("returns empty array for empty colors", () => {
      expect(calculateWidths([])).toEqual([]);
    });

    it("handles single color", () => {
      const colors = [{ hex: "#f00", name: "red", score: 1 }];
      const widths = calculateWidths(colors);
      expect(widths[0]).toBe(100);
    });
  });

  describe("minimum width enforcement", () => {
    it("bumps small colors to minimum (3%)", () => {
      const colors = [
        { hex: "#f00", name: "red", score: 0.99 },
        { hex: "#0f0", name: "green", score: 0.01 },
      ];
      const widths = calculateWidths(colors);

      // Small color should be bumped to 3%
      expect(widths[1]).toBe(3);
      // Large color gets the remaining 97%
      expect(widths[0]).toBeCloseTo(97);
    });

    it("scales large colors down when small ones are bumped", () => {
      const colors = [
        { hex: "#f00", name: "red", score: 0.96 },
        { hex: "#0f0", name: "green", score: 0.02 }, // 2% is below 3% minimum
        { hex: "#00f", name: "blue", score: 0.02 }, // 2% is below 3% minimum
      ];
      const widths = calculateWidths(colors);

      // Both small colors get bumped to 3% each = 6%
      expect(widths[1]).toBe(3);
      expect(widths[2]).toBe(3);
      // Large color gets remaining 94%
      expect(widths[0]).toBeCloseTo(94);
    });

    it("distributes evenly when all colors would be below minimum", () => {
      // 50 colors × 3% minimum = 150%, impossible
      const colors = Array.from({ length: 50 }, (_, i) => ({
        hex: `#${i.toString(16).padStart(6, "0")}`,
        name: `color-${i}`,
        score: 0.02,
      }));
      const widths = calculateWidths(colors);

      // Should distribute evenly at 2% each
      for (const width of widths) {
        expect(width).toBeCloseTo(2);
      }
    });
  });

  describe("edge cases", () => {
    it("handles undefined scores as 0", () => {
      const colors = [
        { hex: "#f00", name: "red", score: 0.5 },
        { hex: "#0f0", name: "green" }, // undefined score
        { hex: "#00f", name: "blue", score: 0.5 },
      ];
      const widths = calculateWidths(colors);

      // Undefined is treated as 0, bumped to minimum
      expect(widths[1]).toBe(3);
    });

    it("handles all zero scores", () => {
      const colors = [
        { hex: "#f00", name: "red", score: 0 },
        { hex: "#0f0", name: "green", score: 0 },
      ];
      const widths = calculateWidths(colors);

      // All get bumped to minimum, then distributed evenly
      expect(widths[0]).toBe(50);
      expect(widths[1]).toBe(50);
    });
  });

  describe("total width invariant", () => {
    it("always sums to 100%", () => {
      const testCases = [
        [{ hex: "#f00", name: "a", score: 1 }],
        [
          { hex: "#f00", name: "a", score: 0.8 },
          { hex: "#0f0", name: "b", score: 0.2 },
        ],
        [
          { hex: "#f00", name: "a", score: 0.9 },
          { hex: "#0f0", name: "b", score: 0.05 },
          { hex: "#00f", name: "c", score: 0.05 },
        ],
        [
          { hex: "#f00", name: "a", score: 0.01 },
          { hex: "#0f0", name: "b", score: 0.01 },
          { hex: "#00f", name: "c", score: 0.98 },
        ],
      ];

      for (const colors of testCases) {
        const widths = calculateWidths(colors);
        const total = widths.reduce((sum, w) => sum + w, 0);
        expect(total).toBeCloseTo(100);
      }
    });
  });
});
