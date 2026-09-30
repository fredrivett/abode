import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUserWithMfa, mockList } = vi.hoisted(() => ({
  mockGetUserWithMfa: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUserWithMfa,
}));

vi.mock("@/lib/personal-access-tokens", () => ({
  listTokenSavedItems: mockList,
}));

vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { encodeCursor } from "@/lib/pagination";
import { GET } from "./route";

const TOKEN_ID = "11111111-1111-4111-8111-111111111111";

function request(query = "") {
  return {
    nextUrl: new URL(
      `http://localhost/api/v1/tokens/${TOKEN_ID}/items${query}`,
    ),
  } as unknown as NextRequest;
}

const ctx = { params: Promise.resolve({ id: TOKEN_ID }) };

beforeEach(() => {
  vi.resetAllMocks();
  mockGetUserWithMfa.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockList.mockResolvedValue({ items: [], nextCursor: null });
});

describe("GET /api/v1/tokens/[id]/items", () => {
  it("rejects a request without a session that passed 2FA", async () => {
    mockGetUserWithMfa.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request(), ctx)).status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("lists the first page for the signed-in owner", async () => {
    const page = {
      items: [{ id: "i1", title: "Saved", kind: null, sourceUrl: null }],
      nextCursor: "next",
    };
    mockList.mockResolvedValue(page);

    const response = await GET(request(), ctx);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(mockList).toHaveBeenCalledWith({
      userId: "user_1",
      tokenId: TOKEN_ID,
      cursor: null,
      limit: 25,
    });
  });

  it("decodes the cursor for the next page", async () => {
    const cursor = { addedAt: "2026-09-01T00:00:00.000Z", id: TOKEN_ID };
    await GET(request(`?cursor=${encodeCursor(cursor)}`), ctx);
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ cursor }));
  });

  it("rejects a malformed or empty cursor", async () => {
    for (const query of ["?cursor=garbage", "?cursor="]) {
      const response = await GET(request(query), ctx);
      expect(response.status).toBe(400);
    }
    expect(mockList).not.toHaveBeenCalled();
  });

  it("404s for a token that isn't the caller's", async () => {
    mockList.mockResolvedValue(null);
    expect((await GET(request(), ctx)).status).toBe(404);
  });
});
