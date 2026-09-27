import type { MetadataRoute } from "next";
import { isIndexableDeployment, SITEMAP_PATHS } from "@/lib/seo/indexing";
import {
  getIndexablePublicContentPaths,
  MAX_SITEMAP_URLS,
} from "@/lib/seo/public-content-sitemap";
import { getAppBaseUrl } from "@/lib/url";

// Reads opted-in users from the DB per request rather than at build time
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexableDeployment()) return [];

  const baseUrl = getAppBaseUrl();
  const publicContent = await getIndexablePublicContentPaths({
    limit: MAX_SITEMAP_URLS - SITEMAP_PATHS.length,
  });

  return [
    ...SITEMAP_PATHS.map((path) => ({ url: `${baseUrl}${path}` })),
    ...publicContent.map(({ path, lastModified }) => ({
      url: `${baseUrl}${path}`,
      lastModified,
    })),
  ];
}
