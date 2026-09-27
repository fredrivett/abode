import type { MetadataRoute } from "next";
import { isIndexableDeployment } from "@/lib/seo/indexing";
import { getAppBaseUrl } from "@/lib/url";

// App and auth pages stay crawlable so bots can see their `noindex` meta —
// a robots.txt block would hide it and still let bare URLs get indexed
export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    sitemap: `${getAppBaseUrl()}/sitemap.xml`,
  };
}
