// Baked at build time from wxt.config.ts. __ABODE_LOCAL__ is true for a local
// build (bun run dev / build:local); __ABODE_DEV_BASE_URL__ is the workspace's
// abode origin (CONDUCTOR_PORT, else :3300).
declare const __ABODE_LOCAL__: boolean;
declare const __ABODE_DEV_BASE_URL__: string;
// Build identity baked in wxt.config.ts. buildNumber is 0 outside CI.
declare const __ABODE_BUILD_NUMBER__: number;
declare const __ABODE_BUILD_SHA__: string;

// An explicit WXT_ABODE_BASE_URL always wins (e.g. .env.production → prod).
// Otherwise: local builds target the workspace server; normal builds target prod.
const abodeBaseUrl =
  import.meta.env.WXT_ABODE_BASE_URL ||
  (__ABODE_LOCAL__ ? __ABODE_DEV_BASE_URL__ : "https://www.abode.fyi");

/**
 * Runtime config, sourced from WXT env vars (see .env.example). Values are
 * public — the same URL/anon key the web app ships.
 */
export const CONFIG = {
  abodeBaseUrl,
  supabaseUrl: import.meta.env.WXT_SUPABASE_URL ?? "http://localhost:55321",
  supabaseAnonKey: import.meta.env.WXT_SUPABASE_ANON_KEY ?? "",
  // CI run number of this build (0 for a local build) + the commit short SHA.
  buildNumber: __ABODE_BUILD_NUMBER__,
  buildSha: __ABODE_BUILD_SHA__,
} as const;

export function isConfigured(): boolean {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}
