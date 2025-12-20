/// <reference types="vitest/globals" />
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserMetadata, getUserWithMetadata } from "./user-metadata";

// Mock the db module
vi.mock("@/lib/db", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import db from "@/lib/db";

function createMockSupabase(options: {
  claims?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
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

function mockDbUser(
  dbUser: { username?: string | null; avatarUrl?: string | null } | null,
) {
  vi.mocked(db.user.findUnique).mockResolvedValue(
    dbUser as ReturnType<typeof db.user.findUnique> extends Promise<infer T>
      ? T
      : never,
  );
}

describe("getUserMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUser(null);
  });

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

  it("extracts avatarUrl from database", async () => {
    mockDbUser({ username: null, avatarUrl: "https://example.com/avatar.jpg" });
    const supabase = createMockSupabase({
      user: { id: "user-123" },
    });

    const result = await getUserMetadata(supabase);

    expect(result.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("returns null avatarUrl when not in database", async () => {
    mockDbUser({ username: null, avatarUrl: null });
    const supabase = createMockSupabase({
      user: {
        id: "user-123",
        user_metadata: { picture: "https://oauth.com/pic.jpg" },
      },
    });

    const result = await getUserMetadata(supabase);

    // OAuth picture is no longer used - only DB avatar
    expect(result.avatarUrl).toBe(null);
  });

  it("returns null avatarUrl when user not found in database", async () => {
    mockDbUser(null);
    const supabase = createMockSupabase({
      user: { id: "user-123" },
    });

    const result = await getUserMetadata(supabase);

    expect(result.avatarUrl).toBe(null);
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUser(null);
  });

  it("returns user object and metadata", async () => {
    const supabase = createMockSupabase({
      claims: { email: "test@example.com" },
      user: {
        id: "user-123",
        email: "test@example.com",
        user_metadata: { first_name: "John", last_name: "Doe" },
      },
    });

    const result = await getUserWithMetadata(supabase);

    expect(result.user).toEqual({
      id: "user-123",
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
