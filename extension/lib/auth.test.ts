import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { getAccessToken, getAuthState, recheckAuthState } from "./auth";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answers supabase-js's refresh-token request with the given response. */
function stubRefresh(response: { status: number; body: object }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(response.body), {
          status: response.status,
        }),
    ),
  );
}

/** A session body as the auth server returns it from a refresh. */
function refreshedSession({
  aal,
  hasVerifiedFactor,
}: {
  aal: string;
  hasVerifiedFactor: boolean;
}) {
  return {
    access_token: jwt(aal),
    refresh_token: "refresh-2",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: "user_1",
      aud: "authenticated",
      factors: hasVerifiedFactor
        ? [{ id: "factor_1", factor_type: "totp", status: "verified" }]
        : [],
    },
  };
}

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

describe("re-checking after the API refuses a save", () => {
  it("signs out when the session was revoked", async () => {
    storeSession({ aal: "aal2", hasVerifiedFactor: true });
    stubRefresh({
      status: 400,
      body: {
        code: "refresh_token_not_found",
        error_code: "refresh_token_not_found",
        msg: "Invalid Refresh Token",
      },
    });
    expect(await recheckAuthState()).toBe("signedOut");
  });

  it("asks for a code when 2FA was turned on since signing in", async () => {
    storeSession({ aal: "aal1", hasVerifiedFactor: false });
    stubRefresh({
      status: 200,
      body: refreshedSession({ aal: "aal1", hasVerifiedFactor: true }),
    });
    expect(await recheckAuthState()).toBe("mfaRequired");
  });

  it("stays signed in when the session is still valid, so the save can be retried", async () => {
    storeSession({ aal: "aal2", hasVerifiedFactor: true });
    stubRefresh({
      status: 200,
      body: refreshedSession({ aal: "aal2", hasVerifiedFactor: true }),
    });
    expect(await recheckAuthState()).toBe("signedIn");
  });
});
