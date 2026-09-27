import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppBaseUrl } from "@/lib/url";
import robots from "./robots";
import sitemap from "./sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("allows crawling on the production deployment, except API and auth callbacks", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
      sitemap: `${getAppBaseUrl()}/sitemap.xml`,
    });
  });

  it.each([
    ["a preview deployment", "preview"],
    ["local dev / self-hosted", ""],
  ])("blocks all crawling on %s", (_label, vercelEnv) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);

    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("sitemap", () => {
  it("lists the homepage on the production deployment", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(sitemap()).toEqual([{ url: `${getAppBaseUrl()}/` }]);
  });

  it("is empty when the deployment isn't indexable", () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(sitemap()).toEqual([]);
  });
});
