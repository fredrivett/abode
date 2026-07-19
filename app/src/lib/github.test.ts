import { describe, expect, it } from "vitest";
import { formatStarCount } from "./github";

describe("formatStarCount", () => {
  it("shows counts under 1000 as-is", () => {
    expect(formatStarCount(0)).toBe("0");
    expect(formatStarCount(42)).toBe("42");
    expect(formatStarCount(999)).toBe("999");
  });

  it("compacts thousands to 'k'", () => {
    expect(formatStarCount(1000)).toBe("1k");
    expect(formatStarCount(1200)).toBe("1.2k");
    expect(formatStarCount(12345)).toBe("12.3k");
  });
});
