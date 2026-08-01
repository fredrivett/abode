/**
 * Static security response headers applied to all routes via Next's
 * `headers()` config (see `next.config.ts`).
 *
 * These are the low-risk, statically-configurable hardening headers. A
 * Content-Security-Policy is deliberately NOT included here — it needs source
 * enumeration (Supabase, PostHog, Mapbox, Vercel, the image proxy, fonts, Next
 * inline scripts/styles) and careful tuning, so it's a planned follow-up.
 */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  // Force HTTPS for two years, including subdomains, and allow preload-list
  // inclusion. Browsers ignore this over plain HTTP, so local dev is unaffected.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking protection — no abode HTML route is meant to be third-party
  // iframed (the room "embed" is a shadow-DOM JS widget + a CORS JSON API, not
  // an iframed page), so a blanket DENY is safe.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin (not the full path) on cross-origin navigations
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful features we don't use anywhere in the app
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=()",
  },
  // Allow DNS prefetching for faster cross-origin resource loads
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/**
 * Next.js `headers` config: apply {@link SECURITY_HEADERS} to every route.
 * Async because Next expects `headers` to return a Promise.
 */
export async function securityHeadersConfig(): Promise<
  Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>
> {
  return [
    {
      // Catch-all — matches every route
      source: "/:path*",
      headers: [...SECURITY_HEADERS],
    },
  ];
}
