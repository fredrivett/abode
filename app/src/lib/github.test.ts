import { afterEach, describe, expect, it, vi } from "vitest";
import { formatStarCount, getGitHubStars } from "./github";

function mockFetch(impl: () => Promise<unknown> | never) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => impl()),
  );
}

describe("getGitHubStars", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the star count on success", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ stargazers_count: 1234 }),
    }));
    expect(await getGitHubStars()).toBe(1234);
  });

  it("returns null for a non-ok response (e.g. a private repo 404)", async () => {
    mockFetch(async () => ({ ok: false }));
    expect(await getGitHubStars()).toBeNull();
  });

  it("returns null when the payload has no numeric count", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(await getGitHubStars()).toBeNull();
  });

  it("returns null when the request throws", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    expect(await getGitHubStars()).toBeNull();
  });
});

describe("formatStarCount", () => {
  it("shows counts under 1000 as-is", () => {
    expect(formatStarCount(0)).toBe("0");
    expect(formatStarCount(42)).toBe("42");
    expect(formatStarCount(999)).toBe("999");
  });

  it("compacts thousands to 'k'", () => {
    expect(formatStarCount(1000)).toBe("1k");
    expect(formatStarCount(1200)).toBe("1.2k");
    expect(formatStarCount(12345)).toBe("12.3k");
  });
});
