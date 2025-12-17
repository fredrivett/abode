import { describe, expect, it } from "vitest";
import {
  colorProximity,
  colorsMatch,
  deltaE,
  getColorNames,
  getNearestColorName,
  normalizeColor,
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
      expect(yellowOrange!).toBeLessThan(yellowGreen!);
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

      // Light red should be much closer to red than blue is
      expect(redToLightRed).toBeGreaterThan(redToBlue!);
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
