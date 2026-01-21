import type { SupabaseClient } from "@supabase/supabase-js";

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  return trimmedValue;
}

export type OAuthMetadata = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Get OAuth metadata (email, firstName, lastName) from auth claims only.
 * Does NOT query the database - use this when you'll fetch DB data separately.
 * Returns null for user if not authenticated.
 */
export async function getOAuthMetadata(supabase: SupabaseClient): Promise<{
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
  metadata: OAuthMetadata;
}> {
  const [{ data: claims }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const claimsRecord = (claims?.claims ?? {}) as Record<string, unknown>;
  const claimsUserMetadata = (claimsRecord.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const userMetadata = (userData.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const email = getString(claimsRecord.email) ?? userData.user?.email ?? null;
  const firstName =
    getString(userMetadata.first_name) ??
    getString(userMetadata.given_name) ??
    getString(claimsRecord.given_name) ??
    getString(claimsUserMetadata.given_name) ??
    getString(claimsUserMetadata.first_name) ??
    null;
  const lastName =
    getString(userMetadata.last_name) ??
    getString(userMetadata.family_name) ??
    getString(claimsRecord.family_name) ??
    getString(claimsUserMetadata.family_name) ??
    getString(claimsUserMetadata.last_name) ??
    null;

  return {
    user: userData.user,
    metadata: { email, firstName, lastName },
  };
}
