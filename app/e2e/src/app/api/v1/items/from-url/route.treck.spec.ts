// @treck flow:app/src/app/api/v1/items/from-url/route.ts:POST hash:366d337d26c20595dbc47a7d3db2b1f21d24454f8252bf7811bd8f13f54c4b6c
import { expect, test } from "@playwright/test";

/**
 * E2E tests for POST /api/v1/items/from-url
 *
 * The endpoint:
 * 1. Requires authentication (Supabase session cookie)
 * 2. Validates the request body (url field must be a string)
 * 3. Validates the URL format (must be http/https)
 * 4. Creates an item record with processingStatus="processing" and kind=null
 * 5. Triggers the classify-url background task
 * 6. Returns the created item with HTTP 201
 */

const ENDPOINT = "/api/v1/items/from-url";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sign in with the test user credentials and return the cookies so they can
 * be forwarded to subsequent API requests made via `request.post()`.
 *
 * We hit the Supabase REST sign-in endpoint directly — the app's
 * /api/v1/items/from-url handler reads the session from cookies, so we just
 * need to acquire them once per test that requires auth.
 */
async function getAuthCookies(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const email = process.env.TEST_USER_EMAIL ?? "";
  const password = process.env.TEST_USER_PASSWORD ?? "";

  const resp = await request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      data: { email, password },
    },
  );

  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();

  // The app uses the sb-* cookies that are set by @supabase/ssr.
  // We build them from the access/refresh tokens returned by the sign-in call
  // and forward them as a Cookie header on every app request.
  const accessToken: string = body.access_token;
  const refreshToken: string = body.refresh_token;

  // Cookie names used by @supabase/ssr (project-ref extracted from the URL)
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieValue = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Return a minimal cookie string that Next.js / Supabase SSR will accept
  return [
    `sb-${projectRef}-auth-token=${encodeURIComponent(cookieValue)}`,
  ].join("; ");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("POST /api/v1/items/from-url", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test("happy path — returns 201 with the created item for a valid https URL", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "https://example.com/some-article" },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    // Shape of returned item
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");

    expect(body).toHaveProperty("sourceType", "url");
    expect(body).toHaveProperty(
      "sourceUrl",
      "https://example.com/some-article",
    );
    expect(body).toHaveProperty("processingStatus", "processing");

    // kind starts as null — it will be set by the background classify-url task
    expect(body.kind).toBeNull();

    // Timestamps are present
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("updatedAt");

    // userId is present and matches the authenticated user
    expect(body).toHaveProperty("userId");
    expect(typeof body.userId).toBe("string");
  });

  test("happy path — URL is normalised (trailing slash preserved by the URL parser)", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const rawUrl = "https://www.wikipedia.org/wiki/Playwright_(software)";
    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: rawUrl },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    // The server uses `new URL(url).href` — the parsed canonical form
    expect(body.sourceUrl).toBe(new URL(rawUrl).href);
  });

  // -------------------------------------------------------------------------
  // Authentication errors
  // -------------------------------------------------------------------------

  test("returns 401 when no authentication cookie is provided", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: { url: "https://example.com" },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty("message", "Unauthorized");
  });

  test("returns 401 when an invalid / expired auth token is provided", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      headers: {
        Cookie: "sb-invalid-auth-token=bogus-value",
      },
      data: { url: "https://example.com" },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("message", "Unauthorized");
  });

  // -------------------------------------------------------------------------
  // Request body validation
  // -------------------------------------------------------------------------

  test("returns 400 when the request body is missing the url field", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "URL is required");
  });

  test("returns 400 when the url field is null", async ({ request }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: null },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "URL is required");
  });

  test("returns 400 when the url field is a number instead of a string", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: 12345 },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "URL is required");
  });

  test("returns 400 when the url field is an empty string", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "URL is required");
  });

  // -------------------------------------------------------------------------
  // URL format validation
  // -------------------------------------------------------------------------

  test("returns 400 for a malformed URL string", async ({ request }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "not-a-valid-url" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "Invalid URL format");
  });

  test("returns 400 for a URL with a non-http/https protocol (ftp)", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "ftp://example.com/file.zip" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "Invalid URL format");
  });

  test("returns 400 for a javascript: protocol URL", async ({ request }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "javascript:alert(1)" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "Invalid URL format");
  });

  test("returns 400 for a data: protocol URL", async ({ request }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "data:text/html,<h1>hello</h1>" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("message", "Invalid URL format");
  });

  test("accepts a plain http:// URL (not only https)", async ({ request }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "http://example.com/article" },
    });

    // Both http and https are valid protocols per the source code
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty("sourceUrl", "http://example.com/article");
    expect(body).toHaveProperty("processingStatus", "processing");
  });

  // -------------------------------------------------------------------------
  // Response shape invariants
  // -------------------------------------------------------------------------

  test("response always contains the required item fields", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);

    const response = await request.post(ENDPOINT, {
      headers: { Cookie: cookies },
      data: { url: "https://news.ycombinator.com" },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    const requiredFields = [
      "id",
      "userId",
      "kind",
      "processingStatus",
      "sourceType",
      "sourceUrl",
      "createdAt",
      "updatedAt",
    ];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }

    // sourceType is always "url" for this endpoint
    expect(body.sourceType).toBe("url");
  });

  test("two requests for the same URL create two separate items", async ({
    request,
  }) => {
    const cookies = await getAuthCookies(request);
    const url = "https://example.com/duplicate-test";

    const [resp1, resp2] = await Promise.all([
      request.post(ENDPOINT, { headers: { Cookie: cookies }, data: { url } }),
      request.post(ENDPOINT, { headers: { Cookie: cookies }, data: { url } }),
    ]);

    expect(resp1.status()).toBe(201);
    expect(resp2.status()).toBe(201);

    const body1 = await resp1.json();
    const body2 = await resp2.json();

    // Each request must produce a unique item
    expect(body1.id).not.toBe(body2.id);
  });
});
