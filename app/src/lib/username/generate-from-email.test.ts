import { describe, expect, it } from "vitest";
import { parseEmailToUsername } from "./generate-from-email";

describe("parseEmailToUsername", () => {
  it("extracts local part from email", () => {
    expect(parseEmailToUsername("fred@example.com")).toBe("fred");
    expect(parseEmailToUsername("john@gmail.com")).toBe("john");
  });

  it("removes +alias suffixes", () => {
    expect(parseEmailToUsername("fred+test@example.com")).toBe("fred");
    expect(parseEmailToUsername("user+signup@gmail.com")).toBe("user");
  });

  it("removes dots from local part", () => {
    expect(parseEmailToUsername("fred.rivett@example.com")).toBe("fredrivett");
    expect(parseEmailToUsername("john.doe.smith@gmail.com")).toBe(
      "johndoesmith",
    ); // exactly 12 chars
  });

  it("converts to lowercase", () => {
    expect(parseEmailToUsername("Fred@example.com")).toBe("fred");
    expect(parseEmailToUsername("JOHN@gmail.com")).toBe("john");
  });

  it("removes invalid characters", () => {
    expect(parseEmailToUsername("fred-rivett@example.com")).toBe("fredrivett");
    expect(parseEmailToUsername("john_doe@gmail.com")).toBe("john_doe");
    expect(parseEmailToUsername("user!name@example.com")).toBe("username");
  });

  it("truncates to 12 characters", () => {
    expect(parseEmailToUsername("averylongemail@example.com")).toBe(
      "averylongema",
    );
    expect(parseEmailToUsername("abcdefghijklmnop@test.com")).toBe(
      "abcdefghijkl",
    );
  });

  it("prefixes with user_ when insufficient letters", () => {
    expect(parseEmailToUsername("123456@example.com")).toBe("user_123456");
    expect(parseEmailToUsername("1a@example.com")).toBe("user_1a");
    // 2 letters is fine
    expect(parseEmailToUsername("ab@example.com")).toBe("ab");
  });

  it("handles edge cases", () => {
    expect(parseEmailToUsername("a@example.com")).toBe("user_a");
    expect(parseEmailToUsername("12@example.com")).toBe("user_12");
  });

  it("handles complex emails", () => {
    expect(parseEmailToUsername("fred.rivett+test@example.com")).toBe(
      "fredrivett",
    );
    expect(parseEmailToUsername("John.Doe+signup@Gmail.com")).toBe("johndoe");
  });
});
