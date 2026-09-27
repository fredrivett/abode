import type { MetadataRoute } from "next";
import { isIndexableDeployment } from "@/lib/seo/indexing";
import { getAppBaseUrl } from "@/lib/url";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexableDeployment()) return [];

  return [{ url: `${getAppBaseUrl()}/` }];
}
