import { describe, expect, it } from "vitest";
import { containsOffensiveContent, isReservedWord } from "./reserved-words";

describe("isReservedWord", () => {
  it("returns true for app routes", () => {
    expect(isReservedWord("dashboard")).toBe(true);
    expect(isReservedWord("settings")).toBe(true);
    expect(isReservedWord("login")).toBe(true);
    expect(isReservedWord("signup")).toBe(true);
    expect(isReservedWord("api")).toBe(true);
    expect(isReservedWord("admin")).toBe(true);
  });

  it("returns true for brand terms", () => {
    expect(isReservedWord("abode")).toBe(true);
    expect(isReservedWord("support")).toBe(true);
    expect(isReservedWord("official")).toBe(true);
    expect(isReservedWord("verified")).toBe(true);
  });

  it("returns true for generic terms", () => {
    expect(isReservedWord("user")).toBe(true);
    expect(isReservedWord("profile")).toBe(true);
    expect(isReservedWord("me")).toBe(true);
    expect(isReservedWord("home")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedWord("Dashboard")).toBe(true);
    expect(isReservedWord("SETTINGS")).toBe(true);
    expect(isReservedWord("LoGiN")).toBe(true);
  });

  it("returns false for non-reserved words", () => {
    expect(isReservedWord("fred")).toBe(false);
    expect(isReservedWord("developer")).toBe(false);
    expect(isReservedWord("myusername")).toBe(false);
  });
});

describe("containsOffensiveContent", () => {
  it("returns false for normal words", () => {
    expect(containsOffensiveContent("hello")).toBe(false);
    expect(containsOffensiveContent("developer")).toBe(false);
    expect(containsOffensiveContent("sunshine")).toBe(false);
  });

  it("returns false for edge cases", () => {
    expect(containsOffensiveContent("")).toBe(false);
    expect(containsOffensiveContent("ab")).toBe(false);
  });

  // Note: We don't test specific offensive words to keep the test file clean
  // The implementation checks against a curated list
});
