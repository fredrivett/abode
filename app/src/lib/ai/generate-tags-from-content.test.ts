import { describe, expect, test } from "vitest";
import {
  buildEmbeddingText,
  truncateToTokenLimit,
} from "./generate-tags-from-content";

describe("truncateToTokenLimit", () => {
  test("returns text unchanged when under the token limit", () => {
    const text = "hello world";
    expect(truncateToTokenLimit(text, 100)).toBe(text);
  });

  test("returns text unchanged when exactly at the token limit", () => {
    const text = "one two three four five";
    const tokens = 5;
    expect(truncateToTokenLimit(text, tokens)).toBe(text);
  });

  test("truncates text that exceeds the token limit", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const result = truncateToTokenLimit(text, 10);
    expect(result.length).toBeLessThan(text.length);
    expect(result.length).toBeGreaterThan(0);
  });

  test("handles empty string", () => {
    expect(truncateToTokenLimit("", 100)).toBe("");
  });

  test("handles unicode and emoji", () => {
    const text = "Hello 🌍 world 🎉 testing unicode émojis café";
    const result = truncateToTokenLimit(text, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(text.length);
  });

  test("handles very large text", () => {
    const text = "word ".repeat(10000);
    const result = truncateToTokenLimit(text, 100);
    expect(result.length).toBeLessThan(text.length);
    expect(result.length).toBeGreaterThan(0);
  });

  test("handles limit of 1 token", () => {
    const text = "hello world this is a test";
    const result = truncateToTokenLimit(text, 1);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(text.length);
  });

  test("handles limit of 0 tokens", () => {
    const text = "hello world";
    const result = truncateToTokenLimit(text, 0);
    expect(result).toBe("");
  });
});

describe("buildEmbeddingText", () => {
  test("combines tags and sourceText with double newline", () => {
    const result = buildEmbeddingText(
      ["nature", "landscape"],
      "A beautiful mountain scene",
    );
    expect(result).toBe("nature landscape\n\nA beautiful mountain scene");
  });

  test("returns only tags when no sourceText", () => {
    const result = buildEmbeddingText(["tag1", "tag2"], undefined);
    expect(result).toBe("tag1 tag2");
  });

  test("returns only sourceText when tags are empty", () => {
    const result = buildEmbeddingText([], "Some article content");
    expect(result).toBe("Some article content");
  });

  test("returns null when no tags and no sourceText", () => {
    const result = buildEmbeddingText([], undefined);
    expect(result).toBeNull();
  });

  test("returns null when tags are empty and sourceText is empty string", () => {
    const result = buildEmbeddingText([], "");
    expect(result).toBeNull();
  });

  test("handles single tag", () => {
    const result = buildEmbeddingText(["solo"], "text");
    expect(result).toBe("solo\n\ntext");
  });

  test("handles many tags", () => {
    const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const result = buildEmbeddingText(tags, "content");
    expect(result).toContain("tag0 tag1");
    expect(result).toContain("\n\ncontent");
  });

  test("does not include leading separator when tags are empty", () => {
    const result = buildEmbeddingText([], "content here");
    expect(result).not.toMatch(/^\n/);
    expect(result).toBe("content here");
  });

  test("does not include trailing separator when sourceText is missing", () => {
    const result = buildEmbeddingText(["tag1"], undefined);
    expect(result).not.toMatch(/\n$/);
    expect(result).toBe("tag1");
  });
});
