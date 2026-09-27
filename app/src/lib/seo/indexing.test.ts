import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_INDEX_ROBOTS, publicContentSeo } from "./indexing";

function stubHostedProduction() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicContentSeo", () => {
  it("indexes public content whose owner opted in, with a canonical URL", () => {
    stubHostedProduction();

    expect(
      publicContentSeo({
        ownerAllowsIndexing: true,
        isPublic: true,
        path: "/@fred",
      }),
    ).toEqual({
      robots: { index: true, follow: true },
      alternates: { canonical: "/@fred" },
    });
  });

  it.each([
    [
      "the owner hasn't opted in",
      { ownerAllowsIndexing: false, isPublic: true },
    ],
    [
      "the content isn't public",
      { ownerAllowsIndexing: true, isPublic: false },
    ],
  ])("stays noindex when %s", (_label, flags) => {
    stubHostedProduction();

    expect(publicContentSeo({ ...flags, path: "/@fred" })).toEqual({
      robots: NO_INDEX_ROBOTS,
    });
  });

  it("stays noindex on a preview deployment", () => {
    stubHostedProduction();
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(
      publicContentSeo({
        ownerAllowsIndexing: true,
        isPublic: true,
        path: "/@fred",
      }),
    ).toEqual({ robots: NO_INDEX_ROBOTS });
  });
});
