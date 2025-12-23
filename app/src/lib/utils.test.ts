import { describe, expect, it } from "vitest";
import { formatBytes, getFileSizeFromMeta, getUserInitials } from "./utils";

describe("formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10.0 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });

  it("formats terabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1.0 TB");
  });

  it("handles bigint input", () => {
    expect(formatBytes(BigInt(1024))).toBe("1.0 KB");
    expect(formatBytes(BigInt(1024 * 1024))).toBe("1.0 MB");
  });
});

describe("getUserInitials", () => {
  it("uses first letters from first and last name", () => {
    expect(getUserInitials("Fred", "Rivett", "fred@example.com")).toBe("FR");
  });

  it("uses first two letters of first name when no last name", () => {
    expect(getUserInitials("Fred", null, "fred@example.com")).toBe("FR");
  });

  it("uses first two letters of email when no name", () => {
    expect(getUserInitials(null, null, "fred@example.com")).toBe("FR");
  });

  it("handles single character first name", () => {
    expect(getUserInitials("F", null, "f@example.com")).toBe("F");
  });

  it("uppercases the result", () => {
    expect(getUserInitials("fred", "rivett", "fred@example.com")).toBe("FR");
  });
});

describe("getFileSizeFromMeta", () => {
  it("returns BigInt(0) for null meta", () => {
    expect(getFileSizeFromMeta(null)).toBe(BigInt(0));
  });

  it("returns BigInt(0) for undefined meta", () => {
    expect(getFileSizeFromMeta(undefined)).toBe(BigInt(0));
  });

  it("returns BigInt(0) for meta without size", () => {
    expect(getFileSizeFromMeta({ type: "image/png" })).toBe(BigInt(0));
  });

  it("returns BigInt(0) for non-numeric size", () => {
    expect(getFileSizeFromMeta({ size: "1024" })).toBe(BigInt(0));
    expect(getFileSizeFromMeta({ size: null })).toBe(BigInt(0));
  });

  it("returns BigInt(0) for negative size", () => {
    expect(getFileSizeFromMeta({ size: -100 })).toBe(BigInt(0));
  });

  it("returns BigInt(0) for zero size", () => {
    expect(getFileSizeFromMeta({ size: 0 })).toBe(BigInt(0));
  });

  it("returns correct BigInt for positive size", () => {
    expect(getFileSizeFromMeta({ size: 1024 })).toBe(BigInt(1024));
    expect(getFileSizeFromMeta({ size: 1000000 })).toBe(BigInt(1000000));
  });

  it("floors floating point sizes", () => {
    expect(getFileSizeFromMeta({ size: 1024.7 })).toBe(BigInt(1024));
    expect(getFileSizeFromMeta({ size: 1024.2 })).toBe(BigInt(1024));
  });

  it("handles nested objects with size property", () => {
    expect(getFileSizeFromMeta({ size: 1024, type: "image/png" })).toBe(
      BigInt(1024),
    );
  });
});
