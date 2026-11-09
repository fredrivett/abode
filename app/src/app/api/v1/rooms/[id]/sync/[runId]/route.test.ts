import { NotFoundError } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFindRoom, mockCountItems, mockRetrieve } = vi.hoisted(
  () => ({
    mockGetUser: vi.fn(),
    mockFindRoom: vi.fn(),
    mockCountItems: vi.fn(),
    mockRetrieve: vi.fn(),
  }),
);

vi.mock("@trigger.dev/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@trigger.dev/sdk")>()),
  runs: { retrieve: mockRetrieve },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));
vi.mock("@/lib/db", () => ({
  default: {
    room: { findUnique: mockFindRoom },
    roomItem: { count: mockCountItems },
  },
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET } from "./route";

async function getStatus() {
  const res = await GET(new Request("http://localhost") as never, {
    params: Promise.resolve({ id: "room-1", runId: "run_1" }),
  });
  return { status: res.status, body: await res.json() };
}

const syncRun = (overrides: Record<string, unknown> = {}) => ({
  taskIdentifier: "sync-room-items",
  tags: ["room_room-1", "user_owner"],
  isCompleted: false,
  isSuccess: false,
  ...overrides,
});

describe("GET /api/v1/rooms/:id/sync/:runId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mockFindRoom.mockResolvedValue({ id: "room-1" });
    mockCountItems.mockResolvedValue(7);
  });

  it("rejects a signed-out caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await getStatus()).status).toBe(401);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it("404s a room the caller doesn't own, without looking up the run", async () => {
    mockFindRoom.mockResolvedValue(null);
    expect((await getStatus()).status).toBe(404);
    expect(mockFindRoom).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "room-1", userId: "owner" } }),
    );
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it.each([
    ["another room's sync", syncRun({ tags: ["room_room-2"] })],
    ["a different task", syncRun({ taskIdentifier: "export-user-data" })],
  ])("404s a run that is %s", async (_label, run) => {
    mockRetrieve.mockResolvedValue(run);
    expect(await getStatus()).toEqual({
      status: 404,
      body: { message: "Sync not found" },
    });
  });

  it("404s an unknown run id", async () => {
    mockRetrieve.mockRejectedValue(
      new NotFoundError(404, undefined, "not found", undefined),
    );
    expect((await getStatus()).status).toBe(404);
  });

  it("reports a running sync as pending", async () => {
    mockRetrieve.mockResolvedValue(syncRun());
    expect(await getStatus()).toEqual({
      status: 200,
      body: { status: "pending" },
    });
  });

  it("reports a finished sync with the room's new item count", async () => {
    mockRetrieve.mockResolvedValue(
      syncRun({ isCompleted: true, isSuccess: true }),
    );
    expect(await getStatus()).toEqual({
      status: 200,
      body: { status: "completed", itemCount: 7 },
    });
  });

  it("reports a sync that ended unsuccessfully as failed", async () => {
    mockRetrieve.mockResolvedValue(syncRun({ isCompleted: true }));
    expect(await getStatus()).toEqual({
      status: 200,
      body: { status: "failed" },
    });
  });
});
