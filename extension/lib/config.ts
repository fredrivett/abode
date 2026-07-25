/**
 * Runtime config, sourced from WXT env vars (see .env.example). Values are
 * public — the same URL/anon key the web app ships. Defaults target local dev.
 */
export const CONFIG = {
  abodeBaseUrl:
    import.meta.env.WXT_ABODE_BASE_URL ?? "http://localhost:3300",
  supabaseUrl: import.meta.env.WXT_SUPABASE_URL ?? "http://localhost:55321",
  supabaseAnonKey: import.meta.env.WXT_SUPABASE_ANON_KEY ?? "",
} as const;

export function isConfigured(): boolean {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}
