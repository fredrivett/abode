import { describe, expect, it } from "vitest";
import { GROW_IN_WINDOW_MS, growInTargetPx, isFreshlyAdded } from "./grow-in";

describe("isFreshlyAdded", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");

  it("is true for an item created just now", () => {
    expect(isFreshlyAdded("2026-01-01T00:00:00.000Z", now)).toBe(true);
  });

  it("is true within the window", () => {
    const created = new Date(now - (GROW_IN_WINDOW_MS - 1000)).toISOString();
    expect(isFreshlyAdded(created, now)).toBe(true);
  });

  it("is false once the item is older than the window", () => {
    const created = new Date(now - (GROW_IN_WINDOW_MS + 1000)).toISOString();
    expect(isFreshlyAdded(created, now)).toBe(false);
  });

  it("treats a small future clock skew as fresh", () => {
    const created = new Date(now + 2000).toISOString();
    expect(isFreshlyAdded(created, now)).toBe(true);
  });

  it("is false for an unparseable timestamp", () => {
    expect(isFreshlyAdded("not-a-date", now)).toBe(false);
  });
});

describe("growInTargetPx", () => {
  it("scales the column width by the aspect (height/width)", () => {
    // A 3:4 (portrait) frame in a 300px column is 400px tall.
    expect(growInTargetPx(300, 3, 4)).toBe(400);
  });

  it("returns the column width for a square frame", () => {
    expect(growInTargetPx(280, 1, 1)).toBe(280);
  });

  it("is shorter than the column for a landscape frame", () => {
    expect(growInTargetPx(320, 16, 9)).toBe(180);
  });
});
