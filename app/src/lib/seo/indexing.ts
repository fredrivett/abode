/**
 * Whether search engines may index this deployment. Only the hosted
 * production site opts in — previews, local dev and self-hosted instances
 * (someone's personal library) stay out of search by default.
 */
export function isIndexableDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** `robots` metadata for pages that must never appear in search (app, auth) */
export const NO_INDEX_ROBOTS = { index: false, follow: false } as const;
