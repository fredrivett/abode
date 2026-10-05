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

// Tracks whether we're inside the $transaction callback when the delete +
// dismissal writes run — this is the atomicity the DELETE handler relies on
// (a dismissal pushed outside the atomic block could be lost on rollback and
// the shelf recreated). Splitting the two writes into separate transactions
// would flip these flags and fail the assertions below.
let inTx = false;
let deleteInTx = false;
let updateInTx = false;

describe("DELETE /api/v1/rooms/:id — auto-shelf dismissal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inTx = false;
    deleteInTx = false;
    updateInTx = false;
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mockRoomDelete.mockImplementation(async () => {
      deleteInTx = inTx;
    });
    mockUserUpdate.mockImplementation(async () => {
      updateInTx = inTx;
    });
    // Run the transaction callback against our mock tx, flagging the window.
    mockTransaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<void>) => {
        inTx = true;
        try {
          return await cb({
            room: { delete: mockRoomDelete },
            user: { update: mockUserUpdate },
          });
        } finally {
          inTx = false;
        }
      },
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
    // Both writes must happen inside the same transaction (atomic dismissal).
    expect(deleteInTx).toBe(true);
    expect(updateInTx).toBe(true);
  });

  it("rolls back (500, no dismissal committed) if the transaction fails", async () => {
    mockFindRoom.mockResolvedValue({
      id: "room-1",
      userId: "owner",
      type: "smart",
      visibility: "private",
      autoKind: "book_reading",
    });
    mockUserUpdate.mockRejectedValue(new Error("db down"));

    const res = await del();

    // The route surfaces a 500; because both writes share one transaction, a
    // failed dismissal push means the room delete rolls back too.
    expect(res.status).toBe(500);
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
