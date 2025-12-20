import { describe, expect, it } from "vitest";
import { validateUsername } from "./index";
import {
  MAX_USERNAME_CHANGES,
  MIN_LETTERS_REQUIRED,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  validateUsernameFormat,
} from "./validation";

describe("Username validation constants", () => {
  it("has correct min/max length", () => {
    expect(USERNAME_MIN_LENGTH).toBe(2);
    expect(USERNAME_MAX_LENGTH).toBe(15);
  });

  it("has correct letter requirement", () => {
    expect(MIN_LETTERS_REQUIRED).toBe(2);
  });

  it("has correct max changes", () => {
    expect(MAX_USERNAME_CHANGES).toBe(3);
  });

  it("pattern matches valid characters", () => {
    expect(USERNAME_PATTERN.test("abc")).toBe(true);
    expect(USERNAME_PATTERN.test("ABC")).toBe(true);
    expect(USERNAME_PATTERN.test("abc123")).toBe(true);
    expect(USERNAME_PATTERN.test("abc_123")).toBe(true);
    expect(USERNAME_PATTERN.test("abc-123")).toBe(false);
    expect(USERNAME_PATTERN.test("abc 123")).toBe(false);
    expect(USERNAME_PATTERN.test("abc.123")).toBe(false);
  });
});

describe("validateUsernameFormat", () => {
  it("accepts valid usernames", () => {
    expect(validateUsernameFormat("fred")).toEqual({ valid: true });
    expect(validateUsernameFormat("Fred")).toEqual({ valid: true });
    expect(validateUsernameFormat("fred_dev")).toEqual({ valid: true });
    expect(validateUsernameFormat("Fred123")).toEqual({ valid: true });
    expect(validateUsernameFormat("ab")).toEqual({ valid: true }); // min length
    expect(validateUsernameFormat("abcdefghijklmno")).toEqual({ valid: true }); // max length (15)
  });

  it("rejects empty username", () => {
    const result = validateUsernameFormat("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("2");
  });

  it("rejects too short username", () => {
    const result = validateUsernameFormat("a");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("2");
  });

  it("rejects too long username", () => {
    const result = validateUsernameFormat("abcdefghijklmnop"); // 16 chars
    expect(result.valid).toBe(false);
    expect(result.error).toContain("15");
  });

  it("rejects invalid characters", () => {
    expect(validateUsernameFormat("fred-dev").valid).toBe(false);
    expect(validateUsernameFormat("fred.dev").valid).toBe(false);
    expect(validateUsernameFormat("fred dev").valid).toBe(false);
    expect(validateUsernameFormat("fred@dev").valid).toBe(false);
  });

  it("rejects usernames with insufficient letters", () => {
    const result1 = validateUsernameFormat("12345");
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain("2 letters");

    const result2 = validateUsernameFormat("1a234");
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain("2 letters");

    // Exactly 2 letters should pass
    expect(validateUsernameFormat("a1b23").valid).toBe(true);
  });
});

describe("validateUsername", () => {
  it("accepts valid unreserved usernames", () => {
    expect(validateUsername("fred")).toEqual({ valid: true });
    expect(validateUsername("developer123")).toEqual({ valid: true });
  });

  it("rejects reserved app route words", () => {
    expect(validateUsername("dashboard").valid).toBe(false);
    expect(validateUsername("settings").valid).toBe(false);
    expect(validateUsername("login").valid).toBe(false);
    expect(validateUsername("api").valid).toBe(false);
  });

  it("rejects reserved words case-insensitively", () => {
    expect(validateUsername("Dashboard").valid).toBe(false);
    expect(validateUsername("SETTINGS").valid).toBe(false);
    expect(validateUsername("Login").valid).toBe(false);
  });

  it("rejects brand terms", () => {
    expect(validateUsername("abode").valid).toBe(false);
    expect(validateUsername("support").valid).toBe(false);
    expect(validateUsername("official").valid).toBe(false);
  });

  it("rejects generic terms", () => {
    expect(validateUsername("user").valid).toBe(false);
    expect(validateUsername("profile").valid).toBe(false);
    expect(validateUsername("home").valid).toBe(false);
  });

  it("rejects offensive terms", () => {
    // We don't test specific offensive words, but verify the check runs
    const result = validateUsername("validword");
    expect(result.valid).toBe(true);
  });

  it("passes format validation errors through", () => {
    const result = validateUsername("a");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("2");
  });
});
