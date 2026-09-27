import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFindRoom, mockFindItems } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindRoom: vi.fn(),
  mockFindItems: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));

vi.mock("@/lib/db", () => ({
  default: {
    room: { findUnique: mockFindRoom },
    roomItem: { findMany: mockFindItems },
  },
}));

// Serialization is covered by room-item-query's own tests
vi.mock("@/lib/rooms/room-item-query", () => ({
  roomItemSelect: {},
  toClientRoomItem: (row: { id: string }) => ({ roomItemId: row.id }),
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
    mockFindItems.mockResolvedValue([{ id: "ri-1" }, { id: "ri-2" }]);
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
      where: { roomId: "room-1", item: { excludeFromPublicRooms: false } },
      cursor: { id: "ri-9" },
    });
  });

  it("filters to publicly viewable items for another signed-in user", async () => {
    signedInAs("someone-else");
    roomIs("public");
    await get();
    expect(mockFindItems.mock.calls[0][0].where).toEqual({
      roomId: "room-1",
      item: { excludeFromPublicRooms: false },
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

  it("404s a room that doesn't exist", async () => {
    signedInAs("owner");
    mockFindRoom.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
