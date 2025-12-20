/// <reference types="vitest/globals" />
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserMetadata, getUserWithMetadata } from "./user-metadata";

function createMockSupabase(options: {
  claims?: Record<string, unknown>;
  user?: { email?: string; user_metadata?: Record<string, unknown> } | null;
}): SupabaseClient {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: options.claims ?? {} },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
      }),
    },
  } as unknown as SupabaseClient;
}

describe("getUserMetadata", () => {
  it("extracts email from claims", async () => {
    const supabase = createMockSupabase({
      claims: { email: "test@example.com" },
    });

    const result = await getUserMetadata(supabase);

    expect(result.email).toBe("test@example.com");
  });

  it("falls back to user email when claims email is missing", async () => {
    const supabase = createMockSupabase({
      claims: {},
      user: { email: "user@example.com" },
    });

    const result = await getUserMetadata(supabase);

    expect(result.email).toBe("user@example.com");
  });

  it("extracts firstName from user_metadata.first_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { first_name: "John" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.firstName).toBe("John");
  });

  it("extracts firstName from user_metadata.given_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { given_name: "Jane" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.firstName).toBe("Jane");
  });

  it("extracts firstName from claims.given_name", async () => {
    const supabase = createMockSupabase({
      claims: { given_name: "Alice" },
    });

    const result = await getUserMetadata(supabase);

    expect(result.firstName).toBe("Alice");
  });

  it("extracts firstName from claims.user_metadata.given_name", async () => {
    const supabase = createMockSupabase({
      claims: { user_metadata: { given_name: "Bob" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.firstName).toBe("Bob");
  });

  it("extracts lastName from user_metadata.last_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { last_name: "Doe" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.lastName).toBe("Doe");
  });

  it("extracts lastName from user_metadata.family_name", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { family_name: "Smith" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.lastName).toBe("Smith");
  });

  it("extracts avatarUrl from user_metadata.avatar_url", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { avatar_url: "https://example.com/avatar.jpg" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("extracts avatarUrl from user_metadata.picture", async () => {
    const supabase = createMockSupabase({
      user: { user_metadata: { picture: "https://example.com/picture.jpg" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.avatarUrl).toBe("https://example.com/picture.jpg");
  });

  it("extracts avatarUrl from claims.picture", async () => {
    const supabase = createMockSupabase({
      claims: { picture: "https://example.com/claims-picture.jpg" },
    });

    const result = await getUserMetadata(supabase);

    expect(result.avatarUrl).toBe("https://example.com/claims-picture.jpg");
  });

  it("returns null for all fields when no data is available", async () => {
    const supabase = createMockSupabase({});

    const result = await getUserMetadata(supabase);

    expect(result).toEqual({
      email: null,
      firstName: null,
      lastName: null,
      username: null,
      avatarUrl: null,
    });
  });

  it("ignores empty string values", async () => {
    const supabase = createMockSupabase({
      claims: { email: "  " },
      user: { user_metadata: { first_name: "" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.email).toBe(null);
    expect(result.firstName).toBe(null);
  });

  it("trims whitespace from values", async () => {
    const supabase = createMockSupabase({
      claims: { email: "  test@example.com  " },
      user: { user_metadata: { first_name: "  John  " } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.email).toBe("test@example.com");
    expect(result.firstName).toBe("John");
  });

  it("prioritizes user_metadata over claims for firstName", async () => {
    const supabase = createMockSupabase({
      claims: { given_name: "ClaimsFirst" },
      user: { user_metadata: { first_name: "UserFirst" } },
    });

    const result = await getUserMetadata(supabase);

    expect(result.firstName).toBe("UserFirst");
  });
});

describe("getUserWithMetadata", () => {
  it("returns user object and metadata", async () => {
    const supabase = createMockSupabase({
      claims: { email: "test@example.com" },
      user: {
        email: "test@example.com",
        user_metadata: { first_name: "John", last_name: "Doe" },
      },
    });

    const result = await getUserWithMetadata(supabase);

    expect(result.user).toEqual({
      email: "test@example.com",
      user_metadata: { first_name: "John", last_name: "Doe" },
    });
    expect(result.metadata).toEqual({
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      username: null,
      avatarUrl: null,
    });
  });

  it("returns null user when not authenticated", async () => {
    const supabase = createMockSupabase({
      user: null,
    });

    const result = await getUserWithMetadata(supabase);

    expect(result.user).toBe(null);
  });
});
