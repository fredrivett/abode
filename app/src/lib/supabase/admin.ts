import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. Server-only; never import into
 * client code (it carries the service-role key). The `server-only` import above
 * makes an accidental client import a build error rather than a runtime leak. Used where the server needs to
 * act outside a single user's row-level access, e.g. signing storage URLs for an
 * admin inspecting another user's item.
 */
export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}
