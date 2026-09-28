import type { Metadata } from "next";
import { COMPARISONS } from "@/lib/comparisons";
import { comparePath } from "@/lib/comparisons/paths";
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
export const SITEMAP_PATHS: readonly string[] = [
  "/",
  comparePath(),
  ...COMPARISONS.map(({ slug }) => comparePath(slug)),
];

/** `robots` metadata for pages that must never appear in search (app, auth) */
export const NO_INDEX_ROBOTS = { index: false, follow: false } as const;

/**
 * Search metadata for a public user-content page (profile, room). The
 * `(public)` layout is noindex; a page overrides that only when the owner has
 * opted in (`allowSearchIndexing`), the content is publicly visible, and this
 * deployment is indexable. Items never opt in — they're mostly copies of
 * third-party content (article text, tweets).
 */
export function publicContentSeo({
  ownerAllowsIndexing,
  isPublic,
  path,
}: {
  ownerAllowsIndexing: boolean;
  isPublic: boolean;
  path: string;
}): Pick<Metadata, "robots" | "alternates"> {
  if (!(ownerAllowsIndexing && isPublic && isIndexableDeployment())) {
    return { robots: NO_INDEX_ROBOTS };
  }

  return {
    robots: { index: true, follow: true },
    alternates: { canonical: path },
  };
}
