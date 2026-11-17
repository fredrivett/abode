import { beforeEach, describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store.get(key) }),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        },
        remove: async (key: string) => {
          store.delete(key);
        },
      },
    },
  },
}));
vi.mock("./config", () => ({
  CONFIG: {
    supabaseUrl: "https://project.supabase.test",
    supabaseAnonKey: "anon",
  },
}));

import { getAccessToken, getAuthState } from "./auth";

/** An unsigned JWT carrying the given AAL; the client only decodes it. */
function jwt(aal: string): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ sub: "user_1", aal })}.sig`;
}

/** Stores a session the way supabase-js persists it in `chrome.storage.local`. */
function storeSession({
  aal,
  hasVerifiedFactor,
}: {
  aal: string;
  hasVerifiedFactor: boolean;
}) {
  const factors = hasVerifiedFactor
    ? [{ id: "factor_1", factor_type: "totp", status: "verified" }]
    : [];
  store.set(
    "abode-session",
    JSON.stringify({
      access_token: jwt(aal),
      refresh_token: "refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "user_1", aud: "authenticated", factors },
    }),
  );
}

beforeEach(() => {
  store.clear();
});

describe("2FA-aware session", () => {
  it("withholds an AAL1 token from a 2FA user until they enter a code", async () => {
    storeSession({ aal: "aal1", hasVerifiedFactor: true });
    expect(await getAuthState()).toBe("mfaRequired");
    expect(await getAccessToken()).toBeNull();
  });

  it("hands out the token once the session is AAL2", async () => {
    storeSession({ aal: "aal2", hasVerifiedFactor: true });
    expect(await getAuthState()).toBe("signedIn");
    expect(await getAccessToken()).toBe(jwt("aal2"));
  });

  it("doesn't ask a user without 2FA for a code", async () => {
    storeSession({ aal: "aal1", hasVerifiedFactor: false });
    expect(await getAuthState()).toBe("signedIn");
    expect(await getAccessToken()).toBe(jwt("aal1"));
  });

  it("reports signed out with no stored session", async () => {
    expect(await getAuthState()).toBe("signedOut");
    expect(await getAccessToken()).toBeNull();
  });
});
