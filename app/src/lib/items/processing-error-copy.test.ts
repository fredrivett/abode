import type { ProcessingErrorReason } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getProcessingErrorCopy } from "./processing-error-copy";

const ALL_REASONS: ProcessingErrorReason[] = [
  "source_blocked",
  "source_not_found",
  "source_unreachable",
  "unsupported_content",
  "unknown",
];

describe("getProcessingErrorCopy", () => {
  it("returns copy for every reason code", () => {
    for (const reason of ALL_REASONS) {
      const copy = getProcessingErrorCopy(reason);
      expect(copy.message.length).toBeGreaterThan(0);
      expect(typeof copy.retryable).toBe("boolean");
    }
  });

  it("defaults to the generic message for null/undefined", () => {
    const fallback = getProcessingErrorCopy(undefined);
    expect(fallback).toEqual(getProcessingErrorCopy("unknown"));
    expect(getProcessingErrorCopy(null)).toEqual(fallback);
  });

  it("marks blocked/not-found/unsupported as non-retryable", () => {
    expect(getProcessingErrorCopy("source_blocked").retryable).toBe(false);
    expect(getProcessingErrorCopy("source_not_found").retryable).toBe(false);
    expect(getProcessingErrorCopy("unsupported_content").retryable).toBe(false);
  });

  it("marks unreachable/unknown as retryable", () => {
    expect(getProcessingErrorCopy("source_unreachable").retryable).toBe(true);
    expect(getProcessingErrorCopy("unknown").retryable).toBe(true);
  });
});
