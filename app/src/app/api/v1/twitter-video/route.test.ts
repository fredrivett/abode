import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://www.abode.fyi" }));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "203.0.113.7",
  getRateLimitHeaders: () => ({ "Retry-After": "60" }),
}));

import { GET } from "./route";

const TWIMG_URL =
  "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4";
const MAX_UPSTREAM_BYTES = 150 * 1024 * 1024;

const mockFetch = vi.fn();

function makeRequest({
  headers = {},
  url = TWIMG_URL as string | null,
}: {
  headers?: Record<string, string>;
  url?: string | null;
} = {}): NextRequest {
  const searchParams = new URLSearchParams();
  if (url !== null) searchParams.set("url", url);
  return {
    nextUrl: { searchParams },
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

function upstream({
  status = 200,
  headers = {},
  body = null,
}: {
  status?: number;
  headers?: Record<string, string>;
  body?: BodyInit | null;
} = {}): Response {
  return {
    status,
    headers: new Headers(headers),
    body,
  } as unknown as Response;
}

const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({
    allowed: true,
    remaining: 199,
    resetAt: 0,
  });
  mockFetch.mockResolvedValue(
    upstream({
      status: 200,
      headers: { "content-type": "video/mp4", "content-length": "1048576" },
    }),
  );
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/v1/twitter-video — same-origin gate", () => {
  it("proxies a Sec-Fetch-Site: same-origin request", async () => {
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      TWIMG_URL,
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(res.headers.get("content-type")).toBe("video/mp4");
    // Sec-Fetch-Site gate input is in Vary, so this stays shared-cacheable.
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, s-maxage=86400, immutable",
    );
    // Shared caches must key on the gate input so a cached same-origin 200 is
    // never served to a cross-site request for the same url.
    expect(res.headers.get("Vary")).toBe("Sec-Fetch-Site");
  });

  it("marks fallback-gated responses (no Sec-Fetch-Site) private, not shared-cacheable", async () => {
    // Gate passed on Referer, which shared caches don't key on here — so the
    // response must not enter a shared cache, or a cross-site old-browser embed
    // sharing the "no Sec-Fetch-Site" Vary variant could be served this 200.
    const res = await GET(
      makeRequest({ headers: { referer: "https://www.abode.fyi/rooms/abc" } }),
    );
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control") ?? "";
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
    expect(cacheControl).not.toContain("s-maxage");
  });

  it("proxies a Sec-Fetch-Site: same-site request", async () => {
    const res = await GET(
      makeRequest({ headers: { "sec-fetch-site": "same-site" } }),
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("blocks a cross-site request with 403 and never fetches", async () => {
    const res = await GET(
      makeRequest({ headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks a Sec-Fetch-Site: none (direct address-bar) hit", async () => {
    const res = await GET(
      makeRequest({ headers: { "sec-fetch-site": "none" } }),
    );
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("allows a request with no Sec-Fetch-Site but a matching Referer", async () => {
    const res = await GET(
      makeRequest({ headers: { referer: "https://www.abode.fyi/rooms/abc" } }),
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("allows a request with no Sec-Fetch-Site but a matching Origin", async () => {
    const res = await GET(
      makeRequest({ headers: { origin: "https://www.abode.fyi" } }),
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("blocks a foreign Referer with 403 and never fetches", async () => {
    const res = await GET(
      makeRequest({ headers: { referer: "https://evil.com/embed" } }),
    );
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks a bare request (no Sec-Fetch, no Origin, no Referer)", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/twitter-video — request validation", () => {
  it("returns 400 for a disallowed host and never fetches", async () => {
    const res = await GET(
      makeRequest({ headers: SAME_ORIGIN, url: "https://evil.com/x.mp4" }),
    );
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-https twimg url and never fetches", async () => {
    const res = await GET(
      makeRequest({
        headers: SAME_ORIGIN,
        url: "http://video.twimg.com/x.mp4",
      }),
    );
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the url param is missing and never fetches", async () => {
    const res = await GET(makeRequest({ headers: SAME_ORIGIN, url: null }));
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards the Range header to the upstream", async () => {
    await GET(
      makeRequest({
        headers: { ...SAME_ORIGIN, range: "bytes=0-1023" },
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      TWIMG_URL,
      expect.objectContaining({ headers: { Range: "bytes=0-1023" } }),
    );
  });
});

describe("GET /api/v1/twitter-video — rate limit", () => {
  it("returns 429 with Retry-After and never fetches when over the limit", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      retryAfter: 60,
    });
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rate-limits under the twitterVideo bucket key", async () => {
    await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "203.0.113.7",
      "twitterVideo",
    );
  });
});

describe("GET /api/v1/twitter-video — size cap", () => {
  it("rejects with 413 when Content-Length exceeds the cap", async () => {
    mockFetch.mockResolvedValue(
      upstream({
        status: 200,
        headers: { "content-length": String(MAX_UPSTREAM_BYTES + 1) },
      }),
    );
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(413);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("streams when Content-Length is at the cap", async () => {
    mockFetch.mockResolvedValue(
      upstream({
        status: 200,
        headers: { "content-length": String(MAX_UPSTREAM_BYTES) },
      }),
    );
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/twitter-video — redirects", () => {
  it("does not blindly follow a 3xx to a foreign host (502, one fetch)", async () => {
    mockFetch.mockResolvedValue(
      upstream({
        status: 302,
        headers: { location: "https://evil.example/x.mp4" },
      }),
    );
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(502);
    // The foreign redirect target must never be fetched.
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("follows a 3xx to an allowed host after re-validating it", async () => {
    const redirected = "https://video.twimg.com/other.mp4";
    mockFetch
      .mockResolvedValueOnce(
        upstream({ status: 302, headers: { location: redirected } }),
      )
      .mockResolvedValueOnce(
        upstream({
          status: 200,
          headers: { "content-type": "video/mp4" },
        }),
      );
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      redirected,
      expect.objectContaining({ redirect: "manual" }),
    );
  });
});

describe("twitterVideo rate-limit bucket", () => {
  it("is defined with a positive per-minute limit", async () => {
    const actual =
      await vi.importActual<typeof import("@/lib/rate-limit")>(
        "@/lib/rate-limit",
      );
    expect(actual.RATE_LIMITS.twitterVideo.maxRequests).toBeGreaterThan(0);
    expect(actual.RATE_LIMITS.twitterVideo.windowMs).toBe(60 * 1000);
  });
});
