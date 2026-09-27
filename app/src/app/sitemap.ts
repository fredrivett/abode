import type { MetadataRoute } from "next";
import { isIndexableDeployment, SITEMAP_PATHS } from "@/lib/seo/indexing";
import { getAppBaseUrl } from "@/lib/url";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexableDeployment()) return [];

  const baseUrl = getAppBaseUrl();
  return SITEMAP_PATHS.map((path) => ({ url: `${baseUrl}${path}` }));
}
