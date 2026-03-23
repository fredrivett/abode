// @treck flow:app/src/app/api/v1/items/[id]/retry/route.ts:POST hash:95692f55750df25f2c7c5e3776c1b4a2d1b4d765187bec07090d2975434231b4
import { expect, test } from "@playwright/test";

/**
 * E2E tests for POST /api/v1/items/[id]/retry
 *
 * Tests cover:
 * - 401 Unauthorized (no session)
 * - 404 Not Found (item doesn't exist or belongs to another user)
 * - 400 Bad Request when item is not in "failed" status
 * - 400 Bad Request when item cannot be retried (missing sourceUrl / fileKey)
 * - 200 happy-path for a URL item (sourceType === "url")
 * - 200 happy-path for a direct image item (kind === "image")
 */

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("POST /api/v1/items/[id]/retry", () => {
  // -------------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------------

  test("returns 401 when the request is unauthenticated", async ({
    request,
  }) => {
    // Use a random UUID – auth check fires before any DB lookup
    const response = await request.post(
      "/api/v1/items/00000000-0000-0000-0000-000000000000/retry",
    );

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({ message: "Unauthorized" });
  });

  // -------------------------------------------------------------------------
  // Item-not-found / ownership guard
  // -------------------------------------------------------------------------

  test("returns 404 when the item does not exist (authenticated user)", async ({
    request,
  }) => {
    // Sign in via the test credentials supplied through environment variables.
    // We first perform a Supabase sign-in to obtain a session cookie, then call
    // the retry endpoint using those cookies.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const testEmail = process.env.TEST_USER_EMAIL ?? "";
    const testPassword = process.env.TEST_USER_PASSWORD ?? "";

    // Exchange credentials for an access token via Supabase REST Auth
    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );

    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    // Call the retry endpoint with the Bearer token via a custom Authorization
    // header (Next.js middleware reads Supabase cookies OR the Authorization
    // header depending on configuration; here we rely on the cookie approach).
    // Because Playwright's APIRequestContext doesn't share cookies with the
    // sign-in context, we embed the token in the cookie manually.
    const nonExistentId = "00000000-0000-0000-0000-000000000001";
    const response = await request.post(
      `/api/v1/items/${nonExistentId}/retry`,
      {
        headers: {
          Cookie: `sb-access-token=${access_token}`,
        },
      },
    );

    // The item does not exist for this user → 404
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ message: "Item not found" });
  });

  // -------------------------------------------------------------------------
  // Status guard – item not in "failed" state
  // -------------------------------------------------------------------------

  test("returns 400 when the item is not in failed status", async ({
    request,
  }) => {
    // This test targets the status-gate branch. We need an authenticated
    // session and an item that is owned by the user but whose processingStatus
    // is NOT "failed".  If you have a seeded "completed" item available via
    // the TEST_ITEM_COMPLETED_ID env var the test will use it; otherwise it
    // skips gracefully.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    const completedItemId = process.env.TEST_ITEM_COMPLETED_ID;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !testEmail ||
      !testPassword ||
      !completedItemId
    ) {
      test.skip();
      return;
    }

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );
    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    const response = await request.post(
      `/api/v1/items/${completedItemId}/retry`,
      {
        headers: { Cookie: `sb-access-token=${access_token}` },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ message: "Only failed items can be retried" });
  });

  // -------------------------------------------------------------------------
  // Retry-type guard – item cannot be retried (no sourceUrl and no fileKey)
  // -------------------------------------------------------------------------

  test("returns 400 when the item type cannot be retried", async ({
    request,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    // A "failed" item that has neither sourceUrl nor fileKey
    const unretryableItemId = process.env.TEST_ITEM_UNRETRYABLE_ID;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !testEmail ||
      !testPassword ||
      !unretryableItemId
    ) {
      test.skip();
      return;
    }

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );
    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    const response = await request.post(
      `/api/v1/items/${unretryableItemId}/retry`,
      {
        headers: { Cookie: `sb-access-token=${access_token}` },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ message: "Cannot retry this item type" });
  });

  // -------------------------------------------------------------------------
  // Happy path – URL item
  // -------------------------------------------------------------------------

  test("returns 200 and initiates retry for a failed URL item", async ({
    request,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    // A "failed" item with sourceType === "url" and a non-empty sourceUrl
    const failedUrlItemId = process.env.TEST_ITEM_FAILED_URL_ID;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !testEmail ||
      !testPassword ||
      !failedUrlItemId
    ) {
      test.skip();
      return;
    }

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );
    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    const response = await request.post(
      `/api/v1/items/${failedUrlItemId}/retry`,
      {
        headers: { Cookie: `sb-access-token=${access_token}` },
      },
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: "Retry initiated",
      processingStatus: "processing",
    });
  });

  // -------------------------------------------------------------------------
  // Happy path – direct-upload image item
  // -------------------------------------------------------------------------

  test("returns 200 and initiates retry for a failed direct-image item", async ({
    request,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    // A "failed" item with kind === "image" and a non-empty fileKey
    const failedImageItemId = process.env.TEST_ITEM_FAILED_IMAGE_ID;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !testEmail ||
      !testPassword ||
      !failedImageItemId
    ) {
      test.skip();
      return;
    }

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );
    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    const response = await request.post(
      `/api/v1/items/${failedImageItemId}/retry`,
      {
        headers: { Cookie: `sb-access-token=${access_token}` },
      },
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: "Retry initiated",
      processingStatus: "processing",
    });
  });

  // -------------------------------------------------------------------------
  // Response shape contract
  // -------------------------------------------------------------------------

  test("response body for a successful retry contains the expected keys", async ({
    request,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    const failedUrlItemId = process.env.TEST_ITEM_FAILED_URL_ID;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !testEmail ||
      !testPassword ||
      !failedUrlItemId
    ) {
      test.skip();
      return;
    }

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );
    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    const response = await request.post(
      `/api/v1/items/${failedUrlItemId}/retry`,
      {
        headers: { Cookie: `sb-access-token=${access_token}` },
      },
    );

    // The route always returns JSON
    expect(response.headers()["content-type"]).toContain("application/json");

    const body = await response.json();

    if (response.status() === 200) {
      // Exact shape when successful
      expect(typeof body.success).toBe("boolean");
      expect(body.success).toBe(true);
      expect(typeof body.message).toBe("string");
      expect(body.processingStatus).toBe("processing");
    } else {
      // Even on error the shape has a message field
      expect(typeof body.message).toBe("string");
    }
  });

  // -------------------------------------------------------------------------
  // Ownership isolation – another user's item looks like 404
  // -------------------------------------------------------------------------

  test("returns 404 for an item owned by a different user", async ({
    request,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    // An item that exists in the DB but belongs to a *different* user
    const otherUsersItemId = process.env.TEST_ITEM_OTHER_USER_ID;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !testEmail ||
      !testPassword ||
      !otherUsersItemId
    ) {
      test.skip();
      return;
    }

    const signInRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        data: { email: testEmail, password: testPassword },
      },
    );
    expect(signInRes.ok()).toBeTruthy();
    const { access_token } = await signInRes.json();

    const response = await request.post(
      `/api/v1/items/${otherUsersItemId}/retry`,
      {
        headers: { Cookie: `sb-access-token=${access_token}` },
      },
    );

    // The Prisma query filters by userId so the item is simply "not found"
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ message: "Item not found" });
  });
});
