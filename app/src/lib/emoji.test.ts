import { describe, expect, it } from "vitest";
import { isValidEmoji } from "./emoji";

describe("isValidEmoji", () => {
  describe("valid emojis", () => {
    it("accepts simple emojis", () => {
      expect(isValidEmoji("😀")).toBe(true);
      expect(isValidEmoji("🎉")).toBe(true);
      expect(isValidEmoji("🚀")).toBe(true);
      expect(isValidEmoji("❤")).toBe(true);
      expect(isValidEmoji("🏠")).toBe(true);
    });

    it("accepts emojis with variation selector", () => {
      expect(isValidEmoji("❤️")).toBe(true);
      expect(isValidEmoji("☀️")).toBe(true);
      expect(isValidEmoji("✨")).toBe(true);
    });

    it("accepts flag emojis", () => {
      expect(isValidEmoji("🇺🇸")).toBe(true);
      expect(isValidEmoji("🇬🇧")).toBe(true);
      expect(isValidEmoji("🇨🇦")).toBe(true);
      expect(isValidEmoji("🇯🇵")).toBe(true);
    });

    it("accepts skin tone emojis", () => {
      expect(isValidEmoji("👋🏻")).toBe(true);
      expect(isValidEmoji("👋🏿")).toBe(true);
      expect(isValidEmoji("🙌🏽")).toBe(true);
    });

    it("accepts ZWJ sequence emojis (family, professions)", () => {
      expect(isValidEmoji("👨‍👩‍👧")).toBe(true);
      expect(isValidEmoji("👩‍💻")).toBe(true);
      expect(isValidEmoji("🏳️‍🌈")).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects plain text", () => {
      expect(isValidEmoji("hello")).toBe(false);
      expect(isValidEmoji("test")).toBe(false);
      expect(isValidEmoji("a")).toBe(false);
    });

    it("rejects numbers", () => {
      expect(isValidEmoji("123")).toBe(false);
      expect(isValidEmoji("1")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidEmoji("")).toBe(false);
    });

    it("rejects multiple emojis", () => {
      expect(isValidEmoji("😀😀")).toBe(false);
      expect(isValidEmoji("🎉🚀")).toBe(false);
      expect(isValidEmoji("hello 👋")).toBe(false);
    });

    it("rejects emoji with surrounding text", () => {
      expect(isValidEmoji("hello 😀")).toBe(false);
      expect(isValidEmoji("😀 world")).toBe(false);
      expect(isValidEmoji(" 😀 ")).toBe(false);
    });

    it("rejects special characters", () => {
      expect(isValidEmoji("!")).toBe(false);
      expect(isValidEmoji("@")).toBe(false);
      expect(isValidEmoji("#")).toBe(false);
    });
  });
});
