import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockItemFindFirst,
  mockCheckRateLimit,
  mockGetClientIp,
  mockGetRateLimitHeaders,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindFirst: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockGetRateLimitHeaders: vi.fn(),
}));

vi.mock("@/env", () => ({ isDevelopment: false }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/db", () => ({
  read: { item: { findFirst: mockItemFindFirst } },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
  getRateLimitHeaders: mockGetRateLimitHeaders,
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from "./route";

const ITEM_ID = "item_1";
// Stored (DB) coordinates the map must always be derived from.
const DB_LAT = 47.6205;
const DB_LNG = -122.3493;

const publicRoomWhere = {
  roomItems: { some: { room: { visibility: "public" } } },
};

const mockFetch = vi.fn();

function makeRequest(
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const url = new URL("http://localhost/api/v1/map-image");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return {
    nextUrl: url,
    headers: new Headers(headers),
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MAPBOX_ACCESS_TOKEN = "test-token";
  vi.stubGlobal("fetch", mockFetch);

  mockGetUser.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockItemFindFirst.mockResolvedValue({
    id: ITEM_ID,
    locations: [{ source: "exif", latitude: DB_LAT, longitude: DB_LNG }],
  });
  mockCheckRateLimit.mockReturnValue({
    allowed: true,
    remaining: 59,
    resetAt: 123,
  });
  mockGetClientIp.mockReturnValue("9.9.9.9");
  mockGetRateLimitHeaders.mockReturnValue({});
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
    headers: new Headers({ "content-type": "image/png" }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fetchedUrl(): string {
  return String(mockFetch.mock.calls[0]?.[0]);
}

describe("GET /api/v1/map-image", () => {
  it("returns 400 when itemId is missing", async () => {
    const res = await GET(makeRequest({ lat: "1", lng: "2" }));
    expect(res.status).toBe(400);
    expect(mockItemFindFirst).not.toHaveBeenCalled();
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 404 when the item has no stored location", async () => {
    mockItemFindFirst.mockResolvedValue({ id: ITEM_ID, locations: [] });
    const res = await GET(makeRequest({ itemId: ITEM_ID }));
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe("No location for this item");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("ignores client lat/lng and uses the stored coordinates + fixed zoom", async () => {
    const res = await GET(
      makeRequest({ itemId: ITEM_ID, lat: "1", lng: "2", zoom: "22" }),
    );
    expect(res.status).toBe(200);
    const url = fetchedUrl();
    // Stored coords, not the client-supplied ones.
    expect(url).toContain(`${DB_LNG},${DB_LAT}`);
    expect(url).not.toContain("pin-s+ef4444(2,1)");
    // Zoom is a server constant, not the client's 22.
    expect(url).toContain(`,10,0/`);
    expect(url).not.toContain(",22,0/");
  });

  it("prefers a manual location source over other sources", async () => {
    mockItemFindFirst.mockResolvedValue({
      id: ITEM_ID,
      locations: [
        { source: "exif", latitude: 10, longitude: 20 },
        { source: "manual", latitude: DB_LAT, longitude: DB_LNG },
      ],
    });
    const res = await GET(makeRequest({ itemId: ITEM_ID }));
    expect(res.status).toBe(200);
    const url = fetchedUrl();
    expect(url).toContain(`${DB_LNG},${DB_LAT}`);
    expect(url).not.toContain("pin-s+ef4444(20,10)");
  });

  describe("size handling", () => {
    it("passes through an allowed size", async () => {
      await GET(makeRequest({ itemId: ITEM_ID, width: "300", height: "160" }));
      expect(fetchedUrl()).toContain("300x160@2x");
    });

    it("snaps a disallowed size to the primary size", async () => {
      await GET(
        makeRequest({ itemId: ITEM_ID, width: "9999", height: "9999" }),
      );
      const url = fetchedUrl();
      expect(url).toContain("368x200@2x");
      expect(url).not.toContain("9999");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 with Retry-After when the limit is exceeded", async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: 123,
        retryAfter: 30,
      });
      mockGetRateLimitHeaders.mockReturnValue({ "Retry-After": "30" });

      const res = await GET(makeRequest({ itemId: ITEM_ID }));
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("30");
      expect(mockItemFindFirst).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("keys the limiter on the user id when authenticated", async () => {
      await GET(makeRequest({ itemId: ITEM_ID }));
      expect(mockCheckRateLimit).toHaveBeenCalledWith("user_1", "mapImage");
      expect(mockGetClientIp).not.toHaveBeenCalled();
    });

    it("keys the limiter on the client IP when unauthenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      await GET(makeRequest({ itemId: ITEM_ID }));
      expect(mockGetClientIp).toHaveBeenCalled();
      expect(mockCheckRateLimit).toHaveBeenCalledWith("9.9.9.9", "mapImage");
    });
  });

  describe("access control", () => {
    it("allows an unauthenticated request for a public-room item", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await GET(makeRequest({ itemId: ITEM_ID }));
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
      const res = await GET(makeRequest({ itemId: ITEM_ID }));
      expect(res.status).toBe(401);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 401 for an authenticated non-owner of a private item", async () => {
      mockItemFindFirst.mockResolvedValue(null);
      const res = await GET(makeRequest({ itemId: ITEM_ID }));
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
  });

  it("returns 503 when Mapbox is not configured", async () => {
    process.env.MAPBOX_ACCESS_TOKEN = "";
    const res = await GET(makeRequest({ itemId: ITEM_ID }));
    expect(res.status).toBe(503);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
