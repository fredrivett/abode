import { getBasePort } from "./dev-port";

/** The hosted abode instance — the default when no site URL is configured */
export const HOSTED_APP_URL = "https://www.abode.fyi";

/**
 * Returns the base URL for the app based on the current environment.
 * - Local dev: http://localhost:<port>
 * - Vercel preview: https://{VERCEL_URL}
 * - Self-hosted: NEXT_PUBLIC_SITE_URL (inlined at build, so works client-side)
 * - Production: https://www.abode.fyi
 */
export function getAppBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    // next.config inlines NEXT_PUBLIC_ABODE_PORT in dev; client code can't read
    // ABODE_PORT itself
    const port = process.env.NEXT_PUBLIC_ABODE_PORT || getBasePort();
    return `http://localhost:${port}`;
  }

  const isPreview =
    process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL;

  if (isPreview) return `https://${process.env.VERCEL_URL}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");

  return HOSTED_APP_URL;
}
