import { describe, expect, it } from "vitest";
import { GROW_IN_WINDOW_MS, isFreshlyAdded } from "./grow-in";

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
