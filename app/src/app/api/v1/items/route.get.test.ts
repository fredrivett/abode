import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/db", () => ({
  default: { item: { findMany: m.findMany, count: m.count } },
}));
vi.mock("@/lib/items/query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/items/query")>()),
  transformItem: (item: { id: string }) => ({ id: item.id }),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET } from "./route";

const USER = "user-1";
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function call(query: string) {
  const request = {
    url: `http://localhost/api/v1/items?${query}`,
  } as unknown as Parameters<typeof GET>[0];
  return GET(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
});

describe("GET /api/v1/items?ids=", () => {
  it("returns just the named items, scoped to the caller", async () => {
    m.findMany.mockResolvedValue([{ id: uuid(1) }]);

    const response = await call(`ids=${uuid(1)},${uuid(2)}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [{ id: uuid(1) }] });
    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [uuid(1), uuid(2)] }, userId: USER },
      }),
    );
    // No pagination or total for a by-id fetch
    expect(m.count).not.toHaveBeenCalled();
  });

  it.each([
    ["more than 50 ids", Array.from({ length: 51 }, (_, i) => uuid(i))],
    ["an id that isn't a uuid", [uuid(1), "nope"]],
  ])("rejects %s", async (_, ids) => {
    const response = await call(`ids=${ids.join(",")}`);

    expect(response.status).toBe(400);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});
