import type { ProcessingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { detectProcessingChanges } from "./use-processing-poll";

type Item = {
  id: string;
  processingStatus: ProcessingStatus;
  updatedAt: string;
};

const item = (
  id: string,
  processingStatus: ProcessingStatus,
  updatedAt: string,
): Item => ({ id, processingStatus, updatedAt });

describe("detectProcessingChanges", () => {
  it("reports no change on first sighting (records baseline only)", () => {
    const lastSeen = new Map<string, string>();
    const result = detectProcessingChanges(
      [item("a", "processing", "t1")],
      lastSeen,
    );

    expect(result.changed).toBe(false);
    expect(result.finished).toEqual([]);
    expect(result.updated).toEqual([]);
    // Baseline recorded so the next change is detectable
    expect(lastSeen.get("a")).toBe("t1");
  });

  it("detects a mid-processing update when updatedAt changes", () => {
    const lastSeen = new Map<string, string>([["a", "t1"]]);
    const result = detectProcessingChanges(
      [item("a", "processing", "t2")],
      lastSeen,
    );

    expect(result.changed).toBe(true);
    expect(result.updated.map((i) => i.id)).toEqual(["a"]);
    expect(lastSeen.get("a")).toBe("t2");
  });

  it("does not report an update when updatedAt is unchanged", () => {
    const lastSeen = new Map<string, string>([["a", "t1"]]);
    const result = detectProcessingChanges(
      [item("a", "processing", "t1")],
      lastSeen,
    );

    expect(result.changed).toBe(false);
    expect(result.updated).toEqual([]);
  });

  it("treats completed items as finished", () => {
    const result = detectProcessingChanges(
      [item("a", "completed", "t1")],
      new Map(),
    );

    expect(result.changed).toBe(true);
    expect(result.finished.map((i) => i.id)).toEqual(["a"]);
  });

  it("treats failed items as finished", () => {
    const result = detectProcessingChanges(
      [item("a", "failed", "t1")],
      new Map(),
    );

    expect(result.changed).toBe(true);
    expect(result.finished.map((i) => i.id)).toEqual(["a"]);
  });

  it("flags a change when a URL is classified mid-processing (new kind persisted)", () => {
    // Item was still processing when the grid loaded it (baseline recorded),
    // then classify-url writes `kind: book` and bumps updatedAt — this is the
    // moment the filter options (type list) go stale and must be refreshed.
    const lastSeen = new Map<string, string>([["book-item", "created"]]);
    const result = detectProcessingChanges(
      [item("book-item", "processing", "classified")],
      lastSeen,
    );

    expect(result.changed).toBe(true);
    expect(result.updated.map((i) => i.id)).toEqual(["book-item"]);
  });

  it("returns no change for an empty response", () => {
    const result = detectProcessingChanges([], new Map());
    expect(result.changed).toBe(false);
  });
});
