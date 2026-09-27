import { describe, expect, it } from "vitest";
import { GITHUB_URL } from "@/lib/github";
import { homepageStructuredData, serializeJsonLd } from "./structured-data";

describe("homepageStructuredData", () => {
  const data = homepageStructuredData({
    baseUrl: "https://www.abode.fyi",
    description: "the home for your info",
  });

  it("describes the organization with absolute URLs and the GitHub repo", () => {
    expect(data["@graph"][0]).toMatchObject({
      "@type": "Organization",
      "@id": "https://www.abode.fyi/#organization",
      url: "https://www.abode.fyi/",
      logo: "https://www.abode.fyi/icons/icon-512.png",
      sameAs: [GITHUB_URL],
    });
  });

  it("links the website to its publisher", () => {
    expect(data["@graph"][1]).toMatchObject({
      "@type": "WebSite",
      url: "https://www.abode.fyi/",
      description: "the home for your info",
      publisher: { "@id": "https://www.abode.fyi/#organization" },
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so embedded markup can't break out of the script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)" });

    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)" });
  });
});
