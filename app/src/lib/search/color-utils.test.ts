import { describe, expect, it } from "vitest";
import {
  colorProximity,
  colorsMatch,
  deltaE,
  getColorNames,
  getNearestColorName,
  hexToLab,
  hexToRgb,
  normalizeColor,
  rgbToLab,
} from "./color-utils";

describe("normalizeColor", () => {
  describe("hex color handling", () => {
    it("normalizes 6-char hex to uppercase", () => {
      expect(normalizeColor("#ff0000")).toBe("#FF0000");
      expect(normalizeColor("#00ff00")).toBe("#00FF00");
      expect(normalizeColor("#0000FF")).toBe("#0000FF");
    });

    it("expands 3-char hex to 6-char", () => {
      expect(normalizeColor("#f00")).toBe("#FF0000");
      expect(normalizeColor("#0f0")).toBe("#00FF00");
      expect(normalizeColor("#00f")).toBe("#0000FF");
      expect(normalizeColor("#abc")).toBe("#AABBCC");
    });

    it("handles mixed case hex", () => {
      expect(normalizeColor("#fF0000")).toBe("#FF0000");
      expect(normalizeColor("#AbCdEf")).toBe("#ABCDEF");
    });

    it("returns null for invalid hex", () => {
      expect(normalizeColor("#gg0000")).toBeNull();
      expect(normalizeColor("#12")).toBeNull();
      expect(normalizeColor("#1234567")).toBeNull();
      expect(normalizeColor("#")).toBeNull();
    });
  });

  describe("named color handling", () => {
    it("converts common named colors to hex", () => {
      expect(normalizeColor("red")).toBe("#FF0000");
      expect(normalizeColor("green")).toBe("#00FF00");
      expect(normalizeColor("blue")).toBe("#0000FF");
      expect(normalizeColor("black")).toBe("#000000");
      expect(normalizeColor("white")).toBe("#FFFFFF");
    });

    it("is case insensitive for named colors", () => {
      expect(normalizeColor("RED")).toBe("#FF0000");
      expect(normalizeColor("Red")).toBe("#FF0000");
      expect(normalizeColor("rEd")).toBe("#FF0000");
    });

    it("handles gray/grey variants", () => {
      expect(normalizeColor("gray")).toBe("#808080");
      expect(normalizeColor("grey")).toBe("#808080");
    });

    it("returns null for unknown color names", () => {
      expect(normalizeColor("notacolor")).toBeNull();
      expect(normalizeColor("darkishblue")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("trims whitespace", () => {
      expect(normalizeColor("  red  ")).toBe("#FF0000");
      expect(normalizeColor("  #ff0000  ")).toBe("#FF0000");
    });

    it("returns null for empty string", () => {
      expect(normalizeColor("")).toBeNull();
      expect(normalizeColor("   ")).toBeNull();
    });
  });
});

describe("deltaE", () => {
  describe("identical colors", () => {
    it("returns 0 for identical hex colors", () => {
      expect(deltaE("#FF0000", "#FF0000")).toBe(0);
      expect(deltaE("#00FF00", "#00FF00")).toBe(0);
      expect(deltaE("#0000FF", "#0000FF")).toBe(0);
    });

    it("returns 0 for same color in different formats", () => {
      expect(deltaE("red", "#FF0000")).toBe(0);
      expect(deltaE("#f00", "#FF0000")).toBe(0);
    });
  });

  describe("similar colors", () => {
    it("returns small deltaE for similar colors", () => {
      // Light red vs red - should be relatively small
      const delta = deltaE("#FF0000", "#FF3333");
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(20);
    });

    it("returns larger deltaE for different colors", () => {
      // Red vs blue - should be large
      const delta = deltaE("#FF0000", "#0000FF");
      expect(delta).toBeGreaterThan(100);
    });
  });

  describe("perceptual accuracy", () => {
    it("considers yellow and green more different than yellow and orange", () => {
      const yellowGreen = deltaE("yellow", "green");
      const yellowOrange = deltaE("yellow", "orange");
      expect(yellowGreen).not.toBeNull();
      expect(yellowOrange).not.toBeNull();
      // Using non-null assertion as we've verified both are non-null above
      expect(yellowOrange as number).toBeLessThan(yellowGreen as number);
    });

    it("considers black and white maximally different", () => {
      const delta = deltaE("black", "white");
      expect(delta).toBeGreaterThan(90);
    });
  });

  describe("error handling", () => {
    it("returns null for invalid colors", () => {
      expect(deltaE("invalid", "#FF0000")).toBeNull();
      expect(deltaE("#FF0000", "invalid")).toBeNull();
      expect(deltaE("invalid", "invalid")).toBeNull();
    });
  });
});

describe("colorsMatch", () => {
  describe("exact matches", () => {
    it("returns true for identical colors", () => {
      expect(colorsMatch("#FF0000", "#FF0000")).toBe(true);
      expect(colorsMatch("red", "#FF0000")).toBe(true);
      expect(colorsMatch("blue", "blue")).toBe(true);
    });
  });

  describe("threshold matching", () => {
    it("returns true for colors within default threshold (5.0)", () => {
      // Very similar reds should match
      expect(colorsMatch("#FF0000", "#FE0000")).toBe(true);
      expect(colorsMatch("#FF0000", "#FF0500")).toBe(true);
    });

    it("returns false for colors outside default threshold", () => {
      // Red and blue should not match
      expect(colorsMatch("#FF0000", "#0000FF")).toBe(false);
      // Red and green should not match
      expect(colorsMatch("#FF0000", "#00FF00")).toBe(false);
    });

    it("respects custom threshold", () => {
      // With very strict threshold, even similar colors don't match
      expect(colorsMatch("#FF0000", "#FF1010", 1.0)).toBe(false);
      // With moderately relaxed threshold, similar colors match
      expect(colorsMatch("#FF0000", "#FF3030", 20.0)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns false for invalid colors", () => {
      expect(colorsMatch("invalid", "#FF0000")).toBe(false);
      expect(colorsMatch("#FF0000", "invalid")).toBe(false);
    });
  });
});

describe("colorProximity", () => {
  describe("proximity calculation", () => {
    it("returns 1 for identical colors", () => {
      expect(colorProximity("#FF0000", "#FF0000")).toBe(1);
      expect(colorProximity("red", "red")).toBe(1);
    });

    it("returns value near 1 for similar colors", () => {
      const proximity = colorProximity("#FF0000", "#FF0500");
      expect(proximity).toBeGreaterThan(0.9);
      expect(proximity).toBeLessThanOrEqual(1);
    });

    it("returns value near 0 for very different colors", () => {
      const proximity = colorProximity("red", "blue");
      expect(proximity).toBeGreaterThanOrEqual(0);
      expect(proximity).toBeLessThan(0.2);
    });

    it("clamps output to 0-1 range", () => {
      // Very different colors might produce negative before clamping
      const proximity = colorProximity("black", "white");
      expect(proximity).toBeGreaterThanOrEqual(0);
      expect(proximity).toBeLessThanOrEqual(1);
    });
  });

  describe("relative ordering", () => {
    it("returns higher proximity for more similar colors", () => {
      // Use colors that are clearly more/less similar
      const redToLightRed = colorProximity("#FF0000", "#FF3030");
      const redToBlue = colorProximity("red", "blue");

      // Verify both values are valid before comparing
      expect(redToLightRed).not.toBeNull();
      expect(redToBlue).not.toBeNull();

      // Light red should be much closer to red than blue is
      expect(redToLightRed as number).toBeGreaterThan(redToBlue as number);
      expect(redToLightRed).toBeGreaterThan(0); // Just verify it's positive
    });
  });

  describe("error handling", () => {
    it("returns null for invalid colors", () => {
      expect(colorProximity("invalid", "#FF0000")).toBeNull();
      expect(colorProximity("#FF0000", "invalid")).toBeNull();
    });
  });
});

describe("getColorNames", () => {
  it("returns array of color names", () => {
    const names = getColorNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(20); // We have ~30 colors defined
  });

  it("includes common colors", () => {
    const names = getColorNames();
    expect(names).toContain("red");
    expect(names).toContain("green");
    expect(names).toContain("blue");
    expect(names).toContain("yellow");
    expect(names).toContain("black");
    expect(names).toContain("white");
  });

  it("excludes grey alias (uses gray)", () => {
    const names = getColorNames();
    expect(names).toContain("gray");
    expect(names).not.toContain("grey");
  });
});

describe("getNearestColorName", () => {
  describe("exact matches", () => {
    it("returns exact color name for primary colors", () => {
      expect(getNearestColorName("#FF0000")).toBe("red");
      expect(getNearestColorName("#00FF00")).toBe("green");
      expect(getNearestColorName("#0000FF")).toBe("blue");
    });

    it("returns exact color name for common named colors", () => {
      expect(getNearestColorName("#FFFF00")).toBe("yellow");
      expect(getNearestColorName("#FFA500")).toBe("orange");
      expect(getNearestColorName("#800080")).toBe("purple");
      expect(getNearestColorName("#000000")).toBe("black");
      expect(getNearestColorName("#FFFFFF")).toBe("white");
    });
  });

  describe("nearest matches", () => {
    it("finds red for reddish colors", () => {
      expect(getNearestColorName("#FF3030")).toBe("red"); // Light red
      expect(getNearestColorName("#CC0000")).toBe("red"); // Dark red
      expect(getNearestColorName("#FF1010")).toBe("red"); // Nearly pure red
    });

    it("finds blue for bluish colors", () => {
      expect(getNearestColorName("#0000CC")).toBe("blue"); // Dark blue
      expect(getNearestColorName("#3030FF")).toBe("blue"); // Light blue
    });

    it("finds appropriate color for mixed hues", () => {
      // Orange-ish should map to orange or coral
      const orangeResult = getNearestColorName("#FF6600");
      expect(["orange", "coral"]).toContain(orangeResult);

      // Pink-ish colors (hot pink maps to violet in LAB space)
      const pinkResult = getNearestColorName("#FF69B4");
      expect(["pink", "magenta", "coral", "salmon", "violet"]).toContain(
        pinkResult,
      );
    });

    it("finds gray for grayish colors", () => {
      expect(getNearestColorName("#7F7F7F")).toBe("gray");
      expect(getNearestColorName("#909090")).toBe("gray");
    });
  });

  describe("error handling", () => {
    it("returns null for invalid hex", () => {
      expect(getNearestColorName("invalid")).toBeNull();
      expect(getNearestColorName("#GGGGGG")).toBeNull();
      expect(getNearestColorName("")).toBeNull();
    });
  });

  describe("case handling", () => {
    it("handles lowercase hex", () => {
      expect(getNearestColorName("#ff0000")).toBe("red");
      expect(getNearestColorName("#00ff00")).toBe("green");
    });

    it("handles mixed case hex", () => {
      expect(getNearestColorName("#Ff0000")).toBe("red");
      expect(getNearestColorName("#00fF00")).toBe("green");
    });

    it("handles 3-char hex", () => {
      expect(getNearestColorName("#f00")).toBe("red");
      expect(getNearestColorName("#0f0")).toBe("green");
      expect(getNearestColorName("#00f")).toBe("blue");
    });
  });
});

describe("hexToRgb", () => {
  describe("valid hex colors", () => {
    it("parses primary colors", () => {
      expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("#00FF00")).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
    });

    it("parses black and white", () => {
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("parses mixed colors", () => {
      expect(hexToRgb("#808080")).toEqual({ r: 128, g: 128, b: 128 });
      expect(hexToRgb("#FFA500")).toEqual({ r: 255, g: 165, b: 0 });
    });

    it("handles lowercase hex", () => {
      expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("#aabbcc")).toEqual({ r: 170, g: 187, b: 204 });
    });

    it("handles 3-char hex", () => {
      expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
    });

    it("handles named colors", () => {
      expect(hexToRgb("red")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("blue")).toEqual({ r: 0, g: 0, b: 255 });
    });
  });

  describe("error handling", () => {
    it("returns null for invalid hex", () => {
      expect(hexToRgb("invalid")).toBeNull();
      expect(hexToRgb("#GGGGGG")).toBeNull();
      expect(hexToRgb("")).toBeNull();
    });
  });
});

describe("rgbToLab", () => {
  describe("primary colors", () => {
    it("converts red to LAB", () => {
      const lab = rgbToLab({ r: 255, g: 0, b: 0 });
      // Red in LAB: L ~53, a ~80, b ~67
      expect(lab.l).toBeCloseTo(53.23, 0);
      expect(lab.a).toBeCloseTo(80.11, 0);
      expect(lab.b).toBeCloseTo(67.22, 0);
    });

    it("converts green to LAB", () => {
      const lab = rgbToLab({ r: 0, g: 255, b: 0 });
      // Green in LAB: L ~87, a ~-86, b ~83
      expect(lab.l).toBeCloseTo(87.74, 0);
      expect(lab.a).toBeCloseTo(-86.18, 0);
      expect(lab.b).toBeCloseTo(83.18, 0);
    });

    it("converts blue to LAB", () => {
      const lab = rgbToLab({ r: 0, g: 0, b: 255 });
      // Blue in LAB: L ~32, a ~79, b ~-108
      expect(lab.l).toBeCloseTo(32.3, 0);
      expect(lab.a).toBeCloseTo(79.2, 0);
      expect(lab.b).toBeCloseTo(-107.86, 0);
    });
  });

  describe("black and white", () => {
    it("converts black to LAB", () => {
      const lab = rgbToLab({ r: 0, g: 0, b: 0 });
      // Black in LAB: L=0, a=0, b=0
      expect(lab.l).toBeCloseTo(0, 0);
      expect(lab.a).toBeCloseTo(0, 0);
      expect(lab.b).toBeCloseTo(0, 0);
    });

    it("converts white to LAB", () => {
      const lab = rgbToLab({ r: 255, g: 255, b: 255 });
      // White in LAB: L=100, a~0, b~0
      expect(lab.l).toBeCloseTo(100, 0);
      expect(lab.a).toBeCloseTo(0, 0);
      expect(lab.b).toBeCloseTo(0, 0);
    });
  });

  describe("gray colors", () => {
    it("converts mid-gray to LAB", () => {
      const lab = rgbToLab({ r: 128, g: 128, b: 128 });
      // Gray should have a=0 and b=0
      expect(lab.l).toBeGreaterThan(0);
      expect(lab.l).toBeLessThan(100);
      expect(lab.a).toBeCloseTo(0, 0);
      expect(lab.b).toBeCloseTo(0, 0);
    });
  });
});

describe("hexToLab", () => {
  describe("convenience function", () => {
    it("combines hexToRgb and rgbToLab", () => {
      const lab = hexToLab("#FF0000");
      expect(lab).not.toBeNull();
      // Red in LAB: L ~53, a ~80, b ~67
      expect(lab?.l).toBeCloseTo(53.23, 0);
      expect(lab?.a).toBeCloseTo(80.11, 0);
      expect(lab?.b).toBeCloseTo(67.22, 0);
    });

    it("handles named colors", () => {
      const lab = hexToLab("red");
      expect(lab).not.toBeNull();
      expect(lab?.l).toBeCloseTo(53.23, 0);
    });

    it("handles 3-char hex", () => {
      const lab = hexToLab("#f00");
      expect(lab).not.toBeNull();
      expect(lab?.l).toBeCloseTo(53.23, 0);
    });
  });

  describe("error handling", () => {
    it("returns null for invalid input", () => {
      expect(hexToLab("invalid")).toBeNull();
      expect(hexToLab("#GGGGGG")).toBeNull();
      expect(hexToLab("")).toBeNull();
    });
  });

  describe("consistency with direct conversion", () => {
    it("produces same result as hexToRgb + rgbToLab", () => {
      const hex = "#FFA500"; // Orange
      const rgb = hexToRgb(hex);
      const labDirect = hexToLab(hex);

      expect(rgb).not.toBeNull();
      expect(labDirect).not.toBeNull();

      // biome-ignore lint/style/noNonNullAssertion: verified not null above
      const labManual = rgbToLab(rgb!);
      expect(labDirect?.l).toBeCloseTo(labManual.l, 10);
      expect(labDirect?.a).toBeCloseTo(labManual.a, 10);
      expect(labDirect?.b).toBeCloseTo(labManual.b, 10);
    });
  });
});
