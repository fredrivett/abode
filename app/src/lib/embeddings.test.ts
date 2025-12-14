import { describe, expect, test } from "vitest";
import { extractClipEmbedding, normalizeVector } from "./embeddings";

describe("normalizeVector", () => {
  test("normalizes a vector to unit length", () => {
    const normalized = normalizeVector([3, 4]);
    expect(normalized[0]).toBeCloseTo(0.6, 6);
    expect(normalized[1]).toBeCloseTo(0.8, 6);
  });

  test("throws for a zero vector", () => {
    expect(() => normalizeVector([0, 0])).toThrow(
      "Cannot normalize zero vector",
    );
  });
});

describe("extractClipEmbedding", () => {
  test("handles array-of-arrays output", () => {
    expect(extractClipEmbedding([[1, 2, 3]])).toEqual([1, 2, 3]);
  });

  test("handles object output with embedding property", () => {
    expect(extractClipEmbedding([{ embedding: [1, 2] }])).toEqual([1, 2]);
  });

  test("throws for empty output", () => {
    expect(() => extractClipEmbedding([])).toThrow(
      "Invalid output: expected array with at least one element",
    );
  });

  test("throws for unexpected primitive output", () => {
    expect(() => extractClipEmbedding([123])).toThrow(
      "Unexpected output format: first element is number",
    );
  });
});
