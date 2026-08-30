import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckRateLimit, mockGetUser, mockItemFindFirst } = vi.hoisted(
  () => ({
    mockCheckRateLimit: vi.fn(),
    mockGetUser: vi.fn(),
    mockItemFindFirst: vi.fn(),
  }),
);

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://www.abode.fyi" }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
  // Route auth goes through getUserWithMfa; pass through to the mocked getUser
  getUserWithMfa: () => mockGetUser(),
}));

vi.mock("@/lib/db", () => ({
  read: { item: { findFirst: mockItemFindFirst } },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "203.0.113.7",
  getRateLimitHeaders: () => ({ "Retry-After": "60" }),
}));

import { GET } from "./route";

const ITEM_ID = "item_1";
const TWIMG_URL =
  "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4";
const MAX_UPSTREAM_BYTES = 150 * 1024 * 1024;

// A stored tweet-media JSON blob whose only video variant is TWIMG_URL, so the
// happy-path request's `url` is a variant the item actually owns.
const itemWithVariant = (src: string = TWIMG_URL) => ({
  id: ITEM_ID,
  twitterDetails: {
    media: [{ type: "video", variants: [{ type: "video/mp4", src }] }],
  },
});

const publicRoomWhere = {
  roomItems: { some: { room: { visibility: "public" } } },
};

const mockFetch = vi.fn();

function makeRequest({
  headers = {},
  url = TWIMG_URL as string | null,
  itemId = ITEM_ID as string | null,
}: {
  headers?: Record<string, string>;
  url?: string | null;
  itemId?: string | null;
} = {}): NextRequest {
  const searchParams = new URLSearchParams();
  if (itemId !== null) searchParams.set("itemId", itemId);
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
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockItemFindFirst.mockResolvedValue(itemWithVariant());
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

  it("makes fallback-gated responses (no Sec-Fetch-Site) uncacheable", async () => {
    // Gate passed on Referer, which Vary (Sec-Fetch-Site only) doesn't key on —
    // so no cache (CDN or browser) may store this, or a cross-site old-browser
    // embed sharing the "no Sec-Fetch-Site" variant could be replayed this 200.
    const res = await GET(
      makeRequest({ headers: { referer: "https://www.abode.fyi/rooms/abc" } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
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
  it("returns 400 when itemId is missing and never fetches", async () => {
    const res = await GET(makeRequest({ headers: SAME_ORIGIN, itemId: null }));
    expect(res.status).toBe(400);
    expect(mockItemFindFirst).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

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

describe("GET /api/v1/twitter-video — item scoping", () => {
  it("allows an unauthenticated request for a public-room item", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(200);
    expect(mockItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID, ...publicRoomWhere },
      }),
    );
  });

  it("returns 401 for an unauthenticated request to a private item", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockItemFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 for an authenticated non-owner of a private item", async () => {
    mockItemFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(401);
    expect(mockItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ITEM_ID,
          OR: [{ userId: "user_1" }, publicRoomWhere],
        },
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 when the url is not a stored variant of the item", async () => {
    // Valid, accessible item, but the requested url isn't one of its variants —
    // the item id must not become a free proxy for an arbitrary twimg URL.
    mockItemFindFirst.mockResolvedValue(
      itemWithVariant("https://video.twimg.com/some/other-video.mp4"),
    );
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 when the item has no stored media", async () => {
    mockItemFindFirst.mockResolvedValue({
      id: ITEM_ID,
      twitterDetails: null,
    });
    const res = await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
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

  it("keys the limiter on the user id when authenticated", async () => {
    await GET(makeRequest({ headers: SAME_ORIGIN }));
    expect(mockCheckRateLimit).toHaveBeenCalledWith("user_1", "twitterVideo");
  });

  it("keys the limiter on the client IP when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
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
