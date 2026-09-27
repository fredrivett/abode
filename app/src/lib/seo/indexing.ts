/**
 * Whether search engines may index this deployment. Only the hosted
 * production site opts in — previews, local dev and self-hosted instances
 * (someone's personal library) stay out of search by default.
 */
export function isIndexableDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}
