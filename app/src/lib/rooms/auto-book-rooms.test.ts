import { beforeEach, describe, expect, it, vi } from "vitest";

// ensureBookRooms is called on the book import/capture write path, so its
// contract is that an internal failure must never propagate (never fail item
// capture). These tests mock the DB to force errors and assert it swallows.

const {
  mockRoomFindMany,
  mockRoomCreate,
  mockRoomDelete,
  mockUserFindUnique,
  mockCapture,
  mockSyncRoomItems,
} = vi.hoisted(() => ({
  mockRoomFindMany: vi.fn(),
  mockRoomCreate: vi.fn(),
  mockRoomDelete: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockCapture: vi.fn(),
  mockSyncRoomItems: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    room: {
      findMany: mockRoomFindMany,
      create: mockRoomCreate,
      delete: mockRoomDelete,
    },
    user: { findUnique: mockUserFindUnique },
    item: { count: vi.fn().mockResolvedValue(1) },
    // createShelf wraps the dismissal re-check + create in a transaction.
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { findUnique: mockUserFindUnique },
        room: { create: mockRoomCreate },
      }),
  },
}));

vi.mock("@/lib/posthog-server", () => ({
  captureServerException: mockCapture,
  getPostHogClient: () => null,
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("./room-service", () => ({
  generateRoomSlug: vi.fn().mockResolvedValue("reading"),
  syncRoomItems: mockSyncRoomItems,
}));

import { ensureBookRooms } from "./auto-book-rooms";

describe("ensureBookRooms resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ dismissedAutoRooms: [] });
    mockSyncRoomItems.mockResolvedValue(undefined);
  });

  it("swallows and reports an error while loading state", async () => {
    mockRoomFindMany.mockRejectedValue(new Error("db down"));

    await expect(ensureBookRooms("u1")).resolves.toBeUndefined();
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), "u1");
    expect(mockRoomCreate).not.toHaveBeenCalled();
  });

  it("swallows and reports an error while creating a shelf", async () => {
    mockRoomFindMany.mockResolvedValue([]); // no shelves yet → all three missing
    mockRoomCreate.mockRejectedValue(new Error("insert failed"));

    await expect(ensureBookRooms("u1")).resolves.toBeUndefined();
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), "u1");
  });

  it("rolls the shelf back when membership sync fails", async () => {
    mockRoomFindMany.mockResolvedValue([]); // all three missing
    mockRoomCreate.mockResolvedValue({ id: "room-x" });
    mockSyncRoomItems.mockRejectedValueOnce(new Error("sync boom"));

    await expect(ensureBookRooms("u1")).resolves.toBeUndefined();
    // The just-created shelf is deleted so a transient failure doesn't strand
    // an empty shelf that future ensures would skip as already present.
    expect(mockRoomDelete).toHaveBeenCalledWith({ where: { id: "room-x" } });
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), "u1");
  });
});
