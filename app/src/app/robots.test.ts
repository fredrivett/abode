import { afterEach, describe, expect, it, vi } from "vitest";
import { HOSTED_APP_URL } from "@/lib/url";
import robots from "./robots";
import sitemap from "./sitemap";

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
  it("lists the homepage on the hosted production deployment", () => {
    stubDeployment({ vercelEnv: "production" });

    expect(sitemap()).toEqual([{ url: `${HOSTED_APP_URL}/` }]);
  });

  it("is empty when the deployment isn't indexable", () => {
    stubDeployment({
      vercelEnv: "production",
      siteUrl: "https://abode.example.com",
    });

    expect(sitemap()).toEqual([]);
  });
});
