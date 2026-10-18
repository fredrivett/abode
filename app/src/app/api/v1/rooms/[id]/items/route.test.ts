import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFindRoom, mockFindItems } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindRoom: vi.fn(),
  mockFindItems: vi.fn(),
}));

const connections = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));

vi.mock("@/lib/db", () => {
  const client = {
    room: { findUnique: mockFindRoom },
    roomItem: { findMany: mockFindItems },
  };
  // Each connection records itself, so tests can assert which one was used
  const via = (name: string) =>
    new Proxy(client, {
      get: (models, model: string) =>
        new Proxy(models[model as keyof typeof models], {
          get:
            (ops, op: string) =>
            (...args: unknown[]) => {
              connections.push(name);
              return (ops as Record<string, (...a: unknown[]) => unknown>)[op](
                ...args,
              );
            },
        }),
    });
  return { default: via("db"), systemDb: via("systemDb") };
});

// Serialization is covered by room-item-query's own tests; here we pin that
// the route uses the shared select + serializer (so loaded-more items match
// the page's first page)
const { SHARED_SELECT } = vi.hoisted(() => ({
  SHARED_SELECT: { sharedSelect: true },
}));
vi.mock("@/lib/rooms/room-item-query", () => ({
  roomItemSelect: SHARED_SELECT,
  toClientRoomItem: (row: { id: string }) => ({
    roomItemId: row.id,
    serializedBy: "toClientRoomItem",
  }),
}));

vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET } from "./route";

function get(query = "") {
  return GET(
    new Request(
      `http://localhost/api/v1/rooms/room-1/items${query}`,
    ) as Parameters<typeof GET>[0],
    { params: Promise.resolve({ id: "room-1" }) },
  );
}

function signedInAs(userId: string | null) {
  mockGetUser.mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  });
}

function roomIs(visibility: "public" | "private") {
  mockFindRoom.mockResolvedValue({ id: "room-1", userId: "owner", visibility });
}

describe("GET /api/v1/rooms/:id/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connections.length = 0;
    mockFindItems.mockResolvedValue([{ id: "ri-1" }, { id: "ri-2" }]);
  });

  it("lists on the system connection, gating access itself", async () => {
    signedInAs(null);
    roomIs("public");
    await get();
    expect(connections).toEqual(["systemDb", "systemDb"]);
  });

  it("gives the owner every item of their private room", async () => {
    signedInAs("owner");
    roomIs("private");
    const res = await get();
    expect(res.status).toBe(200);
    expect(mockFindItems.mock.calls[0][0].where).toEqual({ roomId: "room-1" });
    expect((await res.json()).items).toHaveLength(2);
  });

  it("lets a signed-out visitor page a public room's publicly viewable items", async () => {
    signedInAs(null);
    roomIs("public");
    const res = await get("?cursor=ri-9");
    expect(res.status).toBe(200);
    expect(mockFindItems.mock.calls[0][0]).toMatchObject({
      where: { roomId: "room-1", item: { privacy: "standard" } },
      cursor: { id: "ri-9" },
    });
  });

  it("filters to publicly viewable items for another signed-in user", async () => {
    signedInAs("someone-else");
    roomIs("public");
    await get();
    expect(mockFindItems.mock.calls[0][0].where).toEqual({
      roomId: "room-1",
      item: { privacy: "standard" },
    });
  });

  it("404s a private room for anyone but its owner", async () => {
    roomIs("private");
    for (const viewer of [null, "someone-else"]) {
      signedInAs(viewer);
      expect((await get()).status).toBe(404);
    }
    expect(mockFindItems).not.toHaveBeenCalled();
  });

  it("queries with the shared select and serializes with the shared serializer", async () => {
    signedInAs(null);
    roomIs("public");
    const res = await get();
    expect(mockFindItems.mock.calls[0][0].select).toBe(SHARED_SELECT);
    expect((await res.json()).items).toEqual([
      { roomItemId: "ri-1", serializedBy: "toClientRoomItem" },
      { roomItemId: "ri-2", serializedBy: "toClientRoomItem" },
    ]);
  });

  it("returns a page and the cursor for the next when there are more", async () => {
    signedInAs("owner");
    roomIs("public");
    mockFindItems.mockResolvedValue(
      Array.from({ length: 101 }, (_, i) => ({ id: `ri-${i + 1}` })),
    );
    const body = await (await get()).json();
    expect(body.items).toHaveLength(100);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("ri-100");
  });

  it("404s a room that doesn't exist", async () => {
    signedInAs("owner");
    mockFindRoom.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
