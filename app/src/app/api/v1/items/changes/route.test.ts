import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ listItemChanges: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: async () => ({
    user: { id: "user-1" },
    method: "cookie",
  }),
}));
vi.mock("@/lib/items/changes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/items/changes")>()),
  listItemChanges: m.listItemChanges,
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { encodeChangesCursor } from "@/lib/items/changes";
import { GET } from "./route";

function call(query: string) {
  const url = new URL(`http://localhost/api/v1/items/changes?${query}`);
  const request = { url: url.href, nextUrl: url } as unknown as Parameters<
    typeof GET
  >[0];
  return GET(request);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/v1/items/changes", () => {
  it("passes the caller and decoded cursor through, and isn't cached", async () => {
    const cursor = {
      updatedAt: "2026-01-01T00:00:00.000Z",
      id: "7f000000-0000-4000-8000-000000000001",
    };
    m.listItemChanges.mockResolvedValue({
      items: [],
      cursor: "x",
      hasMore: false,
      total: 0,
    });

    const response = await call(
      `cursor=${encodeChangesCursor(cursor)}&limit=500`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(m.listItemChanges).toHaveBeenCalledWith({
      userId: "user-1",
      after: cursor,
      limit: 100,
    });
  });

  it("rejects a cursor it didn't issue, without querying", async () => {
    const response = await call("cursor=forged");
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(m.listItemChanges).not.toHaveBeenCalled();
  });

  it("keeps a failure out of the cache too", async () => {
    m.listItemChanges.mockRejectedValue(new Error("db down"));
    const response = await call("");
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
