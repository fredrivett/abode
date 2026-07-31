import { afterEach, describe, expect, test, vi } from "vitest";
import {
  extractClipEmbedding,
  isReplicateConfigured,
  isTransientReplicateError,
  normalizeVector,
  retryTransientReplicate,
} from "./embeddings";

const noSleep = () => Promise.resolve();

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

describe("isTransientReplicateError", () => {
  test("429 and 5xx are transient", () => {
    expect(isTransientReplicateError({ status: 429 })).toBe(true);
    expect(isTransientReplicateError({ status: 500 })).toBe(true);
    expect(isTransientReplicateError({ status: 503 })).toBe(true);
  });

  test("client errors (401/422) are not transient", () => {
    expect(isTransientReplicateError({ status: 401 })).toBe(false);
    expect(isTransientReplicateError({ status: 422 })).toBe(false);
  });

  test("errors with no status (network/timeout) are transient", () => {
    expect(isTransientReplicateError(new Error("socket hang up"))).toBe(true);
    expect(isTransientReplicateError(undefined)).toBe(true);
  });
});

describe("retryTransientReplicate", () => {
  test("returns the result without retrying on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(
      retryTransientReplicate(fn, { sleepFn: noSleep }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries a transient error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue("ok");
    await expect(
      retryTransientReplicate(fn, { sleepFn: noSleep }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("gives up after the max attempts, throwing the last error", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 });
    await expect(
      retryTransientReplicate(fn, { sleepFn: noSleep }),
    ).rejects.toEqual({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  test("does not retry a non-transient error", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401 });
    await expect(
      retryTransientReplicate(fn, { sleepFn: noSleep }),
    ).rejects.toEqual({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
