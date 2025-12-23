import { describe, expect, it } from "vitest";
import { formatMemberNumber } from "./format-member-number";

describe("formatMemberNumber", () => {
  it("should format single digit numbers with 5 zero-padding", () => {
    expect(formatMemberNumber(1)).toBe("00001");
    expect(formatMemberNumber(9)).toBe("00009");
  });

  it("should format two digit numbers with 5 zero-padding", () => {
    expect(formatMemberNumber(10)).toBe("00010");
    expect(formatMemberNumber(99)).toBe("00099");
  });

  it("should format three digit numbers with 5 zero-padding", () => {
    expect(formatMemberNumber(100)).toBe("00100");
    expect(formatMemberNumber(999)).toBe("00999");
  });

  it("should format four digit numbers with 5 zero-padding", () => {
    expect(formatMemberNumber(1000)).toBe("01000");
    expect(formatMemberNumber(9999)).toBe("09999");
  });

  it("should format five digit numbers without padding", () => {
    expect(formatMemberNumber(10000)).toBe("10000");
    expect(formatMemberNumber(99999)).toBe("99999");
  });

  it("should handle numbers greater than 5 digits", () => {
    expect(formatMemberNumber(100000)).toBe("100000");
    expect(formatMemberNumber(1234567)).toBe("1234567");
  });

  it("should return null for null input", () => {
    expect(formatMemberNumber(null)).toBe(null);
  });

  it("should return null for undefined input", () => {
    expect(formatMemberNumber(undefined)).toBe(null);
  });

  it("should handle zero", () => {
    expect(formatMemberNumber(0)).toBe("00000");
  });
});
