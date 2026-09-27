import { getAppBaseUrl, HOSTED_APP_URL } from "@/lib/url";

/**
 * Whether search engines may index this deployment. Only the hosted abode.fyi
 * production site opts in — previews, local dev and self-hosted instances
 * (someone's personal library, even when deployed to Vercel) stay out of
 * search.
 */
export function isIndexableDeployment(): boolean {
  return (
    process.env.VERCEL_ENV === "production" &&
    getAppBaseUrl() === HOSTED_APP_URL
  );
}

/**
 * Static pages listed in sitemap.xml. A new public marketing page goes here —
 * `route-indexing.test.ts` fails until every page is either listed here,
 * noindex, or an explicit exception.
 */
export const SITEMAP_PATHS = ["/"] as const;

/** `robots` metadata for pages that must never appear in search (app, auth) */
export const NO_INDEX_ROBOTS = { index: false, follow: false } as const;
