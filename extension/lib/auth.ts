import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { browser } from "wxt/browser";
import { CONFIG } from "./config";

/**
 * Persists the Supabase session in `chrome.storage.local` so it survives popup
 * closes and service-worker restarts, and is shared between the popup and the
 * background worker.
 */
const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await browser.storage.local.get(key);
    const value = result[key];
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },
};

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: {
        storage: chromeStorageAdapter,
        storageKey: "abode-session",
        persistSession: true,
        // We refresh on demand (see getAccessToken) rather than relying on a
        // background timer, which MV3 suspends. In the popup, getSession still
        // returns a live session; getAccessToken tops it up when near expiry.
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session> {
  const { data, error } = await supabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned");
  return data.session;
}

/**
 * Completes sign-in for a 2FA user: verifies a code from their authenticator
 * app, upgrading the stored session from AAL1 to AAL2 (the API rejects AAL1
 * tokens for users with 2FA, as the web login's challenge does).
 */
export async function verifyMfa(code: string): Promise<void> {
  const sb = supabase();
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) throw error;
  // `totp` only lists verified factors
  const factor = data.totp[0];
  if (!factor) {
    throw new Error("No authenticator app is set up for this account");
  }
  const { error: verifyError } = await sb.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (verifyError) throw verifyError;
}

export async function signOut(): Promise<void> {
  // Local scope only: clears this extension's stored session without revoking
  // the user's web or other-device sessions (Supabase defaults to global).
  await supabase().auth.signOut({ scope: "local" });
}

export type AuthState = "signedOut" | "mfaRequired" | "signedIn";

export async function getAuthState(): Promise<AuthState> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (!data.session) return "signedOut";
  return (await isMfaPending(sb)) ? "mfaRequired" : "signedIn";
}

/**
 * Whether the stored session still owes a 2FA code: the user has a verified
 * factor but the token is only AAL1. Read locally from the stored session.
 */
async function isMfaPending(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

/**
 * Returns a valid access token, refreshing when it's within 60s of expiry, or
 * null when signed out or mid-2FA (the API would reject the AAL1 token). Called
 * before every save so a stale token from a suspended service worker never
 * reaches the API.
 */
export async function getAccessToken(): Promise<string | null> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  const session = data.session;
  if (!session || (await isMfaPending(sb))) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs - Date.now() >= 60_000) return session.access_token;

  const { data: refreshed, error } = await sb.auth.refreshSession();
  if (error || !refreshed.session) {
    // Best-effort: fall back to the existing token; the API is the final word.
    return session.access_token;
  }
  return refreshed.session.access_token;
}
