import { afterEach, describe, expect, it, vi } from "vitest";
import { SITEMAP_PATHS } from "@/lib/seo/indexing";
import { HOSTED_APP_URL } from "@/lib/url";
import robots from "./robots";
import sitemap from "./sitemap";

const getIndexablePublicContentPaths = vi.hoisted(() => vi.fn());
vi.mock("@/lib/seo/public-content-sitemap", () => ({
  MAX_SITEMAP_URLS: 50_000,
  getIndexablePublicContentPaths,
}));

function stubDeployment({
  vercelEnv,
  siteUrl = "",
}: {
  vercelEnv: string;
  siteUrl?: string;
}) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", vercelEnv);
  vi.stubEnv("VERCEL_URL", "abode-abc123.vercel.app");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
}

afterEach(() => {
  vi.unstubAllEnvs();
  getIndexablePublicContentPaths.mockReset();
});

describe("robots", () => {
  it("allows crawling on the hosted production deployment, except API and auth callbacks", () => {
    stubDeployment({ vercelEnv: "production" });

    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
      sitemap: `${HOSTED_APP_URL}/sitemap.xml`,
    });
  });

  it.each([
    ["a preview deployment", { vercelEnv: "preview" }],
    ["a self-hosted non-Vercel deploy", { vercelEnv: "" }],
    [
      "a self-hosted Vercel production deploy",
      { vercelEnv: "production", siteUrl: "https://abode.example.com" },
    ],
  ])("blocks all crawling on %s", (_label, deployment) => {
    stubDeployment(deployment);

    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("blocks all crawling in local dev", () => {
    vi.stubEnv("VERCEL_ENV", "");

    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("sitemap", () => {
  it("lists static pages and opted-in public content on the hosted production deployment", async () => {
    stubDeployment({ vercelEnv: "production" });
    const lastModified = new Date("2026-09-01");
    getIndexablePublicContentPaths.mockResolvedValue([
      { path: "/@fred", lastModified },
      { path: "/@fred/books", lastModified },
    ]);

    expect(await sitemap()).toEqual([
      ...SITEMAP_PATHS.map((path) => ({ url: `${HOSTED_APP_URL}${path}` })),
      { url: `${HOSTED_APP_URL}/@fred`, lastModified },
      { url: `${HOSTED_APP_URL}/@fred/books`, lastModified },
    ]);
    expect(SITEMAP_PATHS).toContain("/vs/mymind");
    // Leaves room for the static pages under the 50k-per-file limit
    expect(getIndexablePublicContentPaths).toHaveBeenCalledWith({
      limit: 50_000 - SITEMAP_PATHS.length,
    });
  });

  it("is empty, without querying, when the deployment isn't indexable", async () => {
    stubDeployment({
      vercelEnv: "production",
      siteUrl: "https://abode.example.com",
    });

    expect(await sitemap()).toEqual([]);
    expect(getIndexablePublicContentPaths).not.toHaveBeenCalled();
  });
});
