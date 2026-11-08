import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Filter } from "@/lib/search/types";
import type { Room } from "@/lib/types/room";
import type { RoomItemsPage } from "./room-detail";

const { mockToast, filterHandlers } = vi.hoisted(() => ({
  mockToast: {
    loading: vi.fn(() => "toast-1"),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  filterHandlers: { onSave: null as ((f: Filter[]) => Promise<void>) | null },
}));

vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("@/components/layout/dashboard-header/client", () => ({
  DashboardHeaderClient: ({ centerSlot }: { centerSlot?: React.ReactNode }) => (
    <div>{centerSlot}</div>
  ),
}));
vi.mock("@/components/rooms/filter-badges", () => ({
  FilterBadges: () => null,
}));
vi.mock("@/components/rooms/room-header-filters", () => ({
  RoomHeaderFilters: ({
    onSave,
  }: {
    onSave: (filters: Filter[]) => Promise<void>;
  }) => {
    filterHandlers.onSave = onSave;
    return null;
  },
}));
// Render just what the grid would show: the refreshed page once it arrives
vi.mock("./room-detail", () => ({
  RoomDetail: ({ refreshed }: { refreshed: RoomItemsPage | null }) => (
    <div data-testid="grid">
      {refreshed
        ? `${refreshed.items.map((i) => i.id).join(",")} (${refreshed.itemCount})`
        : "initial"}
    </div>
  ),
}));

import { RoomPageClient } from "./room-page-client";

const room: Room = {
  id: "room-1",
  name: "Smart",
  emoji: null,
  slug: "smart",
  type: "smart",
  visibility: "private",
  autoKind: null,
  filters: [{ id: "f1", type: "tag", value: "old", negated: false }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  itemCount: 1,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderPage() {
  render(
    <RoomPageClient
      room={room}
      initialItems={[]}
      initialCursor={null}
      initialHasMore={false}
      isOwner
      isAuthenticated={false}
      availableInvites={0}
      roomOwner={{
        username: "owner",
        firstName: null,
        lastName: null,
        avatarUrl: null,
      }}
    />,
  );
}

async function saveFilters() {
  await act(async () => {
    await filterHandlers.onSave?.([
      { id: "f2", type: "tag", value: "travel", negated: false },
    ]);
  });
}

const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });

describe("RoomPageClient — refresh after a filter save", () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fetchMock = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.useRealTimers();
  });

  it("keeps the grid until the sync finishes, then shows the room's new items", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "room-1", syncRunId: "run_1" })) // PATCH
      .mockResolvedValueOnce(json({ status: "pending" }))
      .mockResolvedValueOnce(json({ status: "completed", itemCount: 9 }))
      .mockResolvedValueOnce(
        json({
          items: [{ id: "x" }, { id: "y" }],
          nextCursor: null,
          hasMore: true,
        }),
      );
    renderPage();
    await saveFilters();
    expect(mockToast.loading).toHaveBeenCalled();

    await tick(); // pending
    expect(screen.getByTestId("grid")).toHaveTextContent("initial");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/rooms/room-1/sync/run_1",
    );

    await tick(); // completed, then the first page is fetched
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/rooms/room-1/items");
    expect(screen.getByTestId("grid")).toHaveTextContent("x,y (9)");
    expect(mockToast.success).toHaveBeenCalledWith("Room updated", {
      id: "toast-1",
    });

    // done: no more polling
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("stops and says so when the sync fails, leaving the grid as it was", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "room-1", syncRunId: "run_1" }))
      .mockResolvedValueOnce(json({ status: "failed" }));
    renderPage();
    await saveFilters();

    await tick();
    expect(mockToast.error).toHaveBeenCalledWith("Failed to update room", {
      id: "toast-1",
    });
    expect(screen.getByTestId("grid")).toHaveTextContent("initial");
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated status errors instead of spinning forever", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "room-1", syncRunId: "run_1" }))
      .mockResolvedValue(json({ message: "Internal server error" }, 500));
    renderPage();
    await saveFilters();

    for (let i = 0; i < 6; i++) await tick();
    expect(mockToast.error).toHaveBeenCalledWith("Failed to refresh items", {
      id: "toast-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1 + 5);
  });
});
