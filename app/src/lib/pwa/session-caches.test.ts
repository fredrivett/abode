import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimUserCaches,
  clearUserCaches,
  releaseUserCaches,
} from "./session-caches";

let store: Set<string>;

function stubCaches(names: string[]) {
  store = new Set(names);
  vi.stubGlobal("caches", {
    keys: vi.fn(async () => [...store]),
    delete: vi.fn(async (name: string) => store.delete(name)),
  });
}

const OWNER_KEY = "abode:sw-cache-owner";

describe("session caches", () => {
  beforeEach(() => {
    localStorage.clear();
    stubCaches([
      "serwist-precache-v2-https://www.abode.fyi/",
      "static-assets",
      "api-cache",
      "item-images",
      "pages",
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears only user-scoped caches", async () => {
    await clearUserCaches();
    expect([...store]).toEqual([
      "serwist-precache-v2-https://www.abode.fyi/",
      "static-assets",
    ]);
  });

  it("is a no-op without Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearUserCaches()).resolves.toBe(true);
  });

  it("swallows Cache Storage errors", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => {
        throw new Error("SecurityError");
      }),
    });
    await expect(clearUserCaches()).resolves.toBe(false);
  });

  it("doesn't record the owner when clearing fails, so the next load retries", async () => {
    localStorage.setItem(OWNER_KEY, "user-a");
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => {
        throw new Error("SecurityError");
      }),
    });
    await claimUserCaches("user-b");
    expect(localStorage.getItem(OWNER_KEY)).toBe("user-a");
  });

  it("applies claims in order, so a slow earlier one can't win", async () => {
    let releaseFirstClear = () => {};
    const firstClear = new Promise<void>((resolve) => {
      releaseFirstClear = resolve;
    });
    const keys = vi
      .fn<() => Promise<string[]>>()
      .mockImplementationOnce(async () => {
        await firstClear;
        return [];
      })
      .mockResolvedValue([]);
    vi.stubGlobal("caches", { keys, delete: vi.fn() });

    const claimA = claimUserCaches("user-a");
    const claimB = claimUserCaches("user-b");
    releaseFirstClear();
    await Promise.all([claimA, claimB]);
    expect(localStorage.getItem(OWNER_KEY)).toBe("user-b");
  });

  it("clears and records the owner when caches have no known owner", async () => {
    await claimUserCaches("user-a");
    expect(store.has("api-cache")).toBe(false);
    expect(localStorage.getItem(OWNER_KEY)).toBe("user-a");
  });

  it("keeps the caches when the owner signs back in", async () => {
    localStorage.setItem(OWNER_KEY, "user-a");
    await claimUserCaches("user-a");
    expect(store.has("api-cache")).toBe(true);
  });

  it("clears another user's caches", async () => {
    localStorage.setItem(OWNER_KEY, "user-a");
    await claimUserCaches("user-b");
    expect(store.has("pages")).toBe(false);
    expect(localStorage.getItem(OWNER_KEY)).toBe("user-b");
  });

  it("clears caches and forgets the owner on release", async () => {
    localStorage.setItem(OWNER_KEY, "user-a");
    await releaseUserCaches();
    expect(store.has("item-images")).toBe(false);
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
  });
});
