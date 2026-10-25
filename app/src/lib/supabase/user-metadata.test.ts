/// <reference types="vitest/globals" />
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOAuthMetadata } from "./user-metadata";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// getOAuthMetadata reads the request's cookie client, so hand it the mock
const { client } = vi.hoisted(() => ({
  client: { current: null as unknown },
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => client.current }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => vi.unstubAllEnvs());

function createMockSupabase(options: {
  claims?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  mfaPending?: boolean;
}): SupabaseClient {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: options.claims ?? {} },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: {
            currentLevel: "aal1",
            nextLevel: options.mfaPending ? "aal2" : "aal1",
          },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({
          data: {
            totp: options.mfaPending ? [{ status: "verified" }] : [],
          },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;
}

function getOAuthMetadataFor(supabase: SupabaseClient) {
  client.current = supabase;
  return getOAuthMetadata();
}

describe("getOAuthMetadata", () => {
  it("returns the user for a session without MFA", async () => {
    const supabase = createMockSupabase({ user: { id: "u1" } });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.user?.id).toBe("u1");
  });

  it("returns no user while the session still owes its MFA challenge", async () => {
    const supabase = createMockSupabase({
      user: { id: "u1" },
      mfaPending: true,
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.user).toBeNull();
  });

  it("extracts email from claims", async () => {
    const supabase = createMockSupabase({
      claims: { email: "test@example.com" },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.email).toBe("test@example.com");
  });

  it("falls back to user email when claims email is missing", async () => {
    const supabase = createMockSupabase({
      claims: {},
      user: { email: "user@example.com" },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.email).toBe("user@example.com");
  });

  it("extracts firstName from user_metadata.first_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { first_name: "John" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.firstName).toBe("John");
  });

  it("extracts firstName from user_metadata.given_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { given_name: "Jane" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.firstName).toBe("Jane");
  });

  it("extracts firstName from claims.given_name", async () => {
    const supabase = createMockSupabase({
      claims: { given_name: "Alice" },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.firstName).toBe("Alice");
  });

  it("extracts firstName from claims.user_metadata.given_name", async () => {
    const supabase = createMockSupabase({
      claims: { user_metadata: { given_name: "Bob" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.firstName).toBe("Bob");
  });

  it("extracts lastName from user_metadata.last_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { last_name: "Doe" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.lastName).toBe("Doe");
  });

  it("extracts lastName from user_metadata.family_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { family_name: "Smith" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.lastName).toBe("Smith");
  });

  it("returns null for all fields when no data is available", async () => {
    const supabase = createMockSupabase({});

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata).toEqual({
      email: null,
      firstName: null,
      lastName: null,
    });
  });

  it("ignores empty string values", async () => {
    const supabase = createMockSupabase({
      claims: { email: "  " },
      user: { user_metadata: { first_name: "" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.email).toBe(null);
    expect(result.metadata.firstName).toBe(null);
  });

  it("trims whitespace from values", async () => {
    const supabase = createMockSupabase({
      claims: { email: "  test@example.com  " },
      user: { user_metadata: { first_name: "  John  " } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.email).toBe("test@example.com");
    expect(result.metadata.firstName).toBe("John");
  });

  it("prioritizes user_metadata over claims for firstName", async () => {
    const supabase = createMockSupabase({
      claims: { given_name: "ClaimsFirst" },
      user: { user_metadata: { first_name: "UserFirst" } },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.metadata.firstName).toBe("UserFirst");
  });

  it("returns user object along with metadata", async () => {
    const supabase = createMockSupabase({
      claims: { email: "test@example.com" },
      user: {
        id: "user-123",
        email: "test@example.com",
        user_metadata: { first_name: "John", last_name: "Doe" },
      },
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.user).toEqual({
      id: "user-123",
      email: "test@example.com",
      user_metadata: { first_name: "John", last_name: "Doe" },
    });
    expect(result.metadata).toEqual({
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
    });
  });

  it("returns null user when not authenticated", async () => {
    const supabase = createMockSupabase({
      user: null,
    });

    const result = await getOAuthMetadataFor(supabase);

    expect(result.user).toBe(null);
  });
});
