import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockFindRoom,
  mockRoomDelete,
  mockUserUpdate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindRoom: vi.fn(),
  mockRoomDelete: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));

vi.mock("@/lib/db", () => ({
  default: {
    room: { findUnique: mockFindRoom },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => ({ capture: vi.fn() }),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/rooms", () => ({ hasValidFilters: vi.fn() }));

import { DELETE } from "./route";

function del() {
  return DELETE(new Request("http://localhost/api/v1/rooms/room-1") as never, {
    params: Promise.resolve({ id: "room-1" }),
  });
}

describe("DELETE /api/v1/rooms/:id — auto-shelf dismissal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    // Run the transaction callback against our mock tx.
    mockTransaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<void>) =>
        cb({
          room: { delete: mockRoomDelete },
          user: { update: mockUserUpdate },
        }),
    );
  });

  it("records the dismissal when deleting an auto-generated shelf", async () => {
    mockFindRoom.mockResolvedValue({
      id: "room-1",
      userId: "owner",
      type: "smart",
      visibility: "private",
      autoKind: "book_reading",
    });

    const res = await del();

    expect(res.status).toBe(204);
    expect(mockRoomDelete).toHaveBeenCalledWith({ where: { id: "room-1" } });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "owner" },
      data: { dismissedAutoRooms: { push: "book_reading" } },
    });
  });

  it("does not touch dismissals when deleting a normal room", async () => {
    mockFindRoom.mockResolvedValue({
      id: "room-1",
      userId: "owner",
      type: "manual",
      visibility: "private",
      autoKind: null,
    });

    const res = await del();

    expect(res.status).toBe(204);
    expect(mockRoomDelete).toHaveBeenCalledWith({ where: { id: "room-1" } });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("404s an unknown room without deleting", async () => {
    mockFindRoom.mockResolvedValue(null);

    const res = await del();

    expect(res.status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
