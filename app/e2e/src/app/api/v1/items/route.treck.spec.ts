// @treck flow:app/src/app/api/v1/items/route.ts:POST hash:020aff639c785efbdee9da2385d5eab1ac8a3f1a21d6e46f68f89357b1bf3036
import { test, expect } from "@playwright/test";

/**
 * E2E tests for POST /api/v1/items
 *
 * Covers:
 *  - Happy path: image item creation (kind=image, fileKey, meta)
 *  - Happy path: URL-sourced item creation (no kind / no fileKey)
 *  - Happy path: non-image kind (kind=document)
 *  - Auth failure: no session cookie → 401
 *  - Validation: invalid kind → 400
 *  - Validation: fileKey not in user's folder → 400
 *  - Response shape verification (fields returned by the select clause)
 */

const API_URL = "/api/v1/items";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sign in via Supabase's password flow and return the cookie header string
 * so every request is authenticated as a real user.
 *
 * The credentials must exist in the test / staging database; they are read
 * from environment variables so they never land in source control.
 */
async function getAuthCookies(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  // Sign in directly against Supabase Auth REST API
  const signInRes = await request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      data: { email, password },
    },
  );

  expect(
    signInRes.ok(),
    `Supabase sign-in failed: ${await signInRes.text()}`,
  ).toBeTruthy();

  const { access_token, refresh_token } = await signInRes.json();

  // Encode the session the way the Supabase SSR helpers expect it
  // (sb-<project>-auth-token stored as a JSON value)
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = encodeURIComponent(
    JSON.stringify({ access_token, refresh_token }),
  );

  return `${cookieName}=${cookieValue}`;
}

/**
 * Derive a valid fileKey prefix for the authenticated user.
 * We decode the JWT payload to extract the `sub` (user-id) without an
 * extra HTTP round-trip.
 */
function userIdFromAccessToken(accessToken: string): string {
  const [, payload] = accessToken.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  return decoded.sub as string;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("POST /api/v1/items", () => {
  // Shared auth state loaded once per worker
  let authCookie: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const email = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email, password },
      },
    );

    expect(
      signInRes.ok(),
      `Supabase sign-in failed: ${await signInRes.text()}`,
    ).toBeTruthy();

    const body = await signInRes.json();
    userId = userIdFromAccessToken(body.access_token);

    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = encodeURIComponent(
      JSON.stringify({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      }),
    );
    authCookie = `${cookieName}=${cookieValue}`;
  });

  // -------------------------------------------------------------------------
  // Happy paths
  // -------------------------------------------------------------------------

  test("creates an image item and returns 201 with correct shape", async ({
    request,
  }) => {
    const fileKey = `${userId}/test-image-${Date.now()}.jpg`;
    const meta = { size: 204800, mimeType: "image/jpeg" };

    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey,
        meta,
        sourceType: "upload",
        sourceUrl: null,
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();

    // Required fields from the Prisma select clause
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");
    expect(body).toHaveProperty("userId", userId);
    expect(body).toHaveProperty("kind", "image");
    expect(body).toHaveProperty("processingStatus", "processing");
    expect(body).toHaveProperty("fileKey", fileKey);
    expect(body).toHaveProperty("sourceType", "upload");
    expect(body).toHaveProperty("sourceUrl", null);
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("updatedAt");

    // meta is stored as passed
    expect(body.meta).toMatchObject(meta);
  });

  test("creates a URL-sourced item (no kind / no fileKey) and returns 201", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        sourceType: "url",
        sourceUrl: "https://example.com/article",
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("userId", userId);
    expect(body.kind).toBeNull();
    expect(body.fileKey).toBeNull();
    expect(body).toHaveProperty("processingStatus", "processing");
    expect(body).toHaveProperty("sourceType", "url");
    expect(body).toHaveProperty("sourceUrl", "https://example.com/article");
  });

  test("creates a non-image item (kind=document) and returns 201", async ({
    request,
  }) => {
    const fileKey = `${userId}/test-doc-${Date.now()}.pdf`;

    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "document",
        fileKey,
        meta: { size: 51200 },
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("kind", "document");
    expect(body).toHaveProperty("processingStatus", "processing");
    expect(body).toHaveProperty("fileKey", fileKey);
    // No image-analysis trigger expected for documents
  });

  test("creates an item with no meta (fileSize defaults to 0) and returns 201", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: `${userId}/no-meta-${Date.now()}.jpg`,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("processingStatus", "processing");
    expect(body.meta).toBeNull();
  });

  test("creates an item with null kind (classification pending) and returns 201", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: null,
        sourceType: "url",
        sourceUrl: "https://example.com/pending",
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.kind).toBeNull();
    expect(body).toHaveProperty("processingStatus", "processing");
  });

  // -------------------------------------------------------------------------
  // Authentication failure
  // -------------------------------------------------------------------------

  test("returns 401 when no auth cookie is provided", async ({ request }) => {
    const res = await request.post(API_URL, {
      data: { kind: "image", fileKey: "someone/file.jpg" },
    });

    expect(res.status()).toBe(401);

    const body = await res.json();
    expect(body).toHaveProperty("message", "Unauthorized");
  });

  test("returns 401 when an invalid / expired auth token is used", async ({
    request,
  }) => {
    const fakeToken = "invalid.token.value";
    const projectRef = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    ).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const badCookie = `${cookieName}=${encodeURIComponent(JSON.stringify({ access_token: fakeToken, refresh_token: "bad" }))}`;

    const res = await request.post(API_URL, {
      headers: { Cookie: badCookie },
      data: { kind: "image", fileKey: "someone/file.jpg" },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("message", "Unauthorized");
  });

  // -------------------------------------------------------------------------
  // Validation: invalid kind
  // -------------------------------------------------------------------------

  test("returns 400 when kind is an unrecognised value", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: { kind: "banana" },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("message", "Kind must be valid if provided");
  });

  test("returns 400 for another unknown kind value", async ({ request }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: { kind: "video_clip" },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("message", "Kind must be valid if provided");
  });

  // -------------------------------------------------------------------------
  // Validation: fileKey path ownership
  // -------------------------------------------------------------------------

  test("returns 400 when fileKey does not start with the user's id prefix", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: "other-user-id/malicious-upload.jpg",
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty(
      "message",
      "File key must be in the user's folder",
    );
  });

  test("returns 400 when fileKey is a path traversal attempt", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: "../../../etc/passwd",
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty(
      "message",
      "File key must be in the user's folder",
    );
  });

  test("returns 400 when fileKey starts with a different uuid", async ({
    request,
  }) => {
    const differentUserId = "00000000-0000-0000-0000-000000000000";
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: `${differentUserId}/file.jpg`,
      },
    });

    // Only valid if differentUserId !== userId (guaranteed by the static zero-UUID)
    if (userId !== differentUserId) {
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty(
        "message",
        "File key must be in the user's folder",
      );
    }
  });

  // -------------------------------------------------------------------------
  // Response contract – field completeness
  // -------------------------------------------------------------------------

  test("response body contains all fields from the Prisma select clause", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: `${userId}/contract-check-${Date.now()}.jpg`,
        meta: { size: 1024 },
        sourceType: "upload",
        sourceUrl: null,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    const requiredFields = [
      "id",
      "userId",
      "kind",
      "processingStatus",
      "fileKey",
      "meta",
      "sourceType",
      "sourceUrl",
      "coverFileKey",
      "createdAt",
      "updatedAt",
    ];

    for (const field of requiredFields) {
      expect(body, `Missing field: ${field}`).toHaveProperty(field);
    }

    // processingStatus must be "processing" immediately after creation
    expect(body.processingStatus).toBe("processing");

    // Timestamps must be parseable ISO strings
    expect(new Date(body.createdAt).getTime()).not.toBeNaN();
    expect(new Date(body.updatedAt).getTime()).not.toBeNaN();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  test("ignores meta.size when size is zero (no storage increment but still 201)", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: `${userId}/zero-size-${Date.now()}.jpg`,
        meta: { size: 0 },
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("processingStatus", "processing");
  });

  test("ignores meta.size when size is negative (treated as 0)", async ({
    request,
  }) => {
    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey: `${userId}/negative-size-${Date.now()}.jpg`,
        meta: { size: -500 },
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("processingStatus", "processing");
  });

  test("accepts fileKey that correctly starts with userId prefix followed by subpath", async ({
    request,
  }) => {
    const fileKey = `${userId}/subfolder/nested/image-${Date.now()}.png`;

    const res = await request.post(API_URL, {
      headers: { Cookie: authCookie },
      data: {
        kind: "image",
        fileKey,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("fileKey", fileKey);
  });

  test("each created item gets a unique id", async ({ request }) => {
    const [res1, res2] = await Promise.all([
      request.post(API_URL, {
        headers: { Cookie: authCookie },
        data: {
          kind: "image",
          fileKey: `${userId}/unique-id-a-${Date.now()}.jpg`,
        },
      }),
      request.post(API_URL, {
        headers: { Cookie: authCookie },
        data: {
          kind: "image",
          fileKey: `${userId}/unique-id-b-${Date.now()}.jpg`,
        },
      }),
    ]);

    expect(res1.status()).toBe(201);
    expect(res2.status()).toBe(201);

    const body1 = await res1.json();
    const body2 = await res2.json();

    expect(body1.id).not.toBe(body2.id);
  });
});
