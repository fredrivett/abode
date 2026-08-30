import { afterEach, describe, expect, test } from "vitest";
import {
  extractClipEmbedding,
  isOpenAiConfigured,
  isReplicateConfigured,
  normalizeVector,
} from "./embeddings";

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

describe("isReplicateConfigured", () => {
  const original = process.env.REPLICATE_API_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = original;
  });

  test("true when a token is set", () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    expect(isReplicateConfigured()).toBe(true);
  });

  test("false when the token is absent", () => {
    delete process.env.REPLICATE_API_TOKEN;
    expect(isReplicateConfigured()).toBe(false);
  });

  test("false when the token is an empty string", () => {
    process.env.REPLICATE_API_TOKEN = "";
    expect(isReplicateConfigured()).toBe(false);
  });
});

describe("isOpenAiConfigured", () => {
  const original = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  test("true when a key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isOpenAiConfigured()).toBe(true);
  });

  test("false when the key is absent", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isOpenAiConfigured()).toBe(false);
  });

  test("false when the key is an empty string", () => {
    process.env.OPENAI_API_KEY = "";
    expect(isOpenAiConfigured()).toBe(false);
  });
});
