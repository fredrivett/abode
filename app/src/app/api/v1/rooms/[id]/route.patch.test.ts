import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFindRoom, mockRoomUpdate, mockTrigger } = vi.hoisted(
  () => ({
    mockGetUser: vi.fn(),
    mockFindRoom: vi.fn(),
    mockRoomUpdate: vi.fn(),
    mockTrigger: vi.fn(),
  }),
);

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mockTrigger } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));
vi.mock("@/lib/db", () => ({
  default: { room: { findUnique: mockFindRoom, update: mockRoomUpdate } },
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => ({ capture: vi.fn() }),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/rooms", () => ({ hasValidFilters: () => true }));

import { PATCH } from "./route";

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/v1/rooms/room-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "room-1" }) },
  );
}

describe("PATCH /api/v1/rooms/:id — filter re-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mockFindRoom.mockResolvedValue({ id: "room-1", type: "smart" });
    mockRoomUpdate.mockResolvedValue({
      id: "room-1",
      _count: { roomItems: 3 },
    });
    mockTrigger.mockResolvedValue({ id: "run_1" });
  });

  it("returns the sync run id, tagged with the room the status endpoint checks", async () => {
    const res = await patch({
      filters: [{ id: "f", type: "tag", value: "travel", negated: false }],
    });

    expect(await res.json()).toMatchObject({ syncRunId: "run_1" });
    expect(mockTrigger).toHaveBeenCalledWith(
      "sync-room-items",
      { roomId: "room-1", userId: "owner" },
      { tags: expect.arrayContaining(["room_room-1"]) },
    );
  });

  it("returns no sync run when the filters didn't change", async () => {
    const res = await patch({ name: "Renamed" });

    expect(await res.json()).not.toHaveProperty("syncRunId");
    expect(mockTrigger).not.toHaveBeenCalled();
  });
});
