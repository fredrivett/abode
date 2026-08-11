import { describe, expect, test } from "vitest";
import { batchIdempotencyKey } from "./batch-idempotency-key";

describe("batchIdempotencyKey", () => {
  test("formats as <prefix>:<64-char sha256 hex>", () => {
    expect(batchIdempotencyKey("reprocess:blur", ["a", "b"])).toMatch(
      /^reprocess:blur:[0-9a-f]{64}$/,
    );
  });

  test("is stable regardless of id ordering", () => {
    expect(batchIdempotencyKey("p", ["a", "b", "c"])).toBe(
      batchIdempotencyKey("p", ["c", "a", "b"]),
    );
  });

  test("differs when the batch membership changes", () => {
    const base = batchIdempotencyKey("p", ["a", "b"]);
    expect(batchIdempotencyKey("p", ["a", "b", "c"])).not.toBe(base);
    expect(batchIdempotencyKey("p", ["a"])).not.toBe(base);
  });

  test("differs by prefix so per-field heals never collide", () => {
    expect(batchIdempotencyKey("reprocess:blur", ["a"])).not.toBe(
      batchIdempotencyKey("reprocess:visual", ["a"]),
    );
  });

  test("stays bounded regardless of batch size", () => {
    const many = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    expect(batchIdempotencyKey("reprocess:blur", many)).toHaveLength(
      "reprocess:blur:".length + 64,
    );
  });
});
