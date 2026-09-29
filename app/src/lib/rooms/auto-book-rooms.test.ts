import { beforeEach, describe, expect, it, vi } from "vitest";

// ensureBookRooms is called on the book import/capture write path, so its
// contract is that an internal failure must never propagate (never fail item
// capture). These tests mock the DB to force errors and assert it swallows.

const { mockRoomFindMany, mockRoomCreate, mockUserFindUnique, mockCapture } =
  vi.hoisted(() => ({
    mockRoomFindMany: vi.fn(),
    mockRoomCreate: vi.fn(),
    mockUserFindUnique: vi.fn(),
    mockCapture: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  default: {
    room: { findMany: mockRoomFindMany, create: mockRoomCreate },
    user: { findUnique: mockUserFindUnique },
    item: { count: vi.fn().mockResolvedValue(1) },
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
  syncRoomItems: vi.fn().mockResolvedValue(undefined),
}));

import { ensureBookRooms } from "./auto-book-rooms";

describe("ensureBookRooms resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ dismissedAutoRooms: [] });
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
});
