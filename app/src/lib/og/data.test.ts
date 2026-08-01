import { describe, expect, it } from "vitest";
import { parseOgUsername } from "./data";

describe("parseOgUsername", () => {
  it("strips the leading @ from a valid handle", () => {
    expect(parseOgUsername("@alice")).toBe("alice");
  });

  it("decodes a percent-encoded @ prefix", () => {
    expect(parseOgUsername("%40alice")).toBe("alice");
  });

  it("returns null when the @ prefix is missing", () => {
    expect(parseOgUsername("alice")).toBeNull();
  });

  it("returns null for a malformed percent-escape instead of throwing", () => {
    // decodeURIComponent("%") throws — must be caught so callers get the
    // neutral fallback rather than a 500.
    expect(parseOgUsername("%")).toBeNull();
    expect(parseOgUsername("@bad%zz")).toBeNull();
  });
});
