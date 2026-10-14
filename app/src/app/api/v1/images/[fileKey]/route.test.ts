// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFindItem, mockDownload } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindItem: vi.fn(),
  mockDownload: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));
vi.mock("@/lib/items/image-key-lookup", () => ({
  findItemOwningImageKey: mockFindItem,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: { from: () => ({ download: mockDownload }) },
  }),
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET } from "./route";

const OWNER = "0f8fad5b-d9cb-469f-a165-70867728950e";
const KEY = `${OWNER}/photo.jpg`;

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    userId: OWNER,
    sharedAt: null,
    excludeFromPublicRooms: false,
    roomItems: [],
    ...overrides,
  };
}

function get(viewerId: string | null) {
  mockGetUser.mockResolvedValue({
    data: { user: viewerId ? { id: viewerId } : null },
  });
  return GET(
    new NextRequest(
      `http://localhost/api/v1/images/${encodeURIComponent(KEY)}`,
    ),
    { params: Promise.resolve({ fileKey: encodeURIComponent(KEY) }) },
  );
}

describe("GET /api/v1/images/[fileKey] cache headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    mockDownload.mockResolvedValue({
      data: new Blob([new Uint8Array([1])], { type: "image/jpeg" }),
      error: null,
    });
  });

  it("keeps an owner-only image out of the shared cache", async () => {
    mockFindItem.mockResolvedValue(item());

    const res = await get(OWNER);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("lets the CDN cache a directly shared image", async () => {
    mockFindItem.mockResolvedValue(item({ sharedAt: new Date() }));

    const res = await get(null);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
  });

  it("lets the CDN cache an image in a public room, even for its owner", async () => {
    mockFindItem.mockResolvedValue(
      item({ roomItems: [{ room: { visibility: "public" } }] }),
    );

    const res = await get(OWNER);

    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
  });

  it("treats an item excluded from public rooms as owner-only", async () => {
    mockFindItem.mockResolvedValue(
      item({
        excludeFromPublicRooms: true,
        roomItems: [{ room: { visibility: "public" } }],
      }),
    );

    const res = await get(OWNER);

    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("refuses an owner-only image to anyone else without downloading it", async () => {
    mockFindItem.mockResolvedValue(item());

    const res = await get("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    expect(res.status).toBe(403);
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
