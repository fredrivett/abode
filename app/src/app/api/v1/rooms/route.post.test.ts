import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockRoomCreate, mockTrigger } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRoomCreate: vi.fn(),
  mockTrigger: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mockTrigger } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));
vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: async () => {
    const { data } = await mockGetUser();
    return data.user ? { user: data.user, method: "cookie" } : null;
  },
}));
vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: vi.fn().mockResolvedValue({ username: "owner" }) },
    room: { create: mockRoomCreate },
  },
}));
vi.mock("@/lib/rooms", () => ({
  generateRoomSlug: vi.fn().mockResolvedValue("travel"),
  hasValidFilters: () => true,
  listUserRooms: vi.fn(),
}));
vi.mock("@/lib/rooms/auto-book-rooms", () => ({ ensureBookRooms: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/milestones", () => ({ markMilestoneComplete: vi.fn() }));
vi.mock("@/lib/milestones/conditions", () => ({
  shouldCompleteCreateDynamicRoom: () => false,
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { POST } from "./route";

function createSmartRoom() {
  return POST(
    new Request("http://localhost/api/v1/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: "Travel",
        type: "smart",
        filters: [{ id: "f", type: "tag", value: "travel", negated: false }],
      }),
    }) as never,
  );
}

describe("POST /api/v1/rooms — smart room population", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TRIGGER_SECRET_KEY", "tr_test");
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mockRoomCreate.mockResolvedValue({ id: "room-1", name: "Travel" });
  });

  it("queues the initial sync for a new smart room", async () => {
    expect((await createSmartRoom()).status).toBe(201);
    expect(mockTrigger).toHaveBeenCalledWith("sync-room-items", {
      roomId: "room-1",
      userId: "owner",
    });
  });

  // Trigger.dev is optional: the room is created before its sync is queued, so
  // a missing or failing Trigger must not turn the create into a 500
  it.each([
    ["isn't configured", () => vi.stubEnv("TRIGGER_SECRET_KEY", ""), 0],
    ["fails", () => mockTrigger.mockRejectedValueOnce(new Error("down")), 1],
  ])("still creates the room when Trigger.dev %s", async (_, setUp, queued) => {
    setUp();

    expect((await createSmartRoom()).status).toBe(201);
    expect(mockRoomCreate).toHaveBeenCalledTimes(1);
    // Without a key nothing is queued; a failing queue is tried once
    expect(mockTrigger).toHaveBeenCalledTimes(queued);
  });
});
