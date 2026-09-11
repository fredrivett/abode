import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Room, RoomItem } from "@/lib/types/room";

// Masonry grid just lays out children in jsdom — render them straight through
vi.mock("@masonry-grid/react", () => ({
  BalancedMasonryGrid: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Frame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ItemCard is animation-heavy; stub it to a delete button that fires onDeleted
vi.mock("@/app/(app)/dashboard/item-card", () => ({
  ItemCard: ({
    item,
    name,
    onDeleted,
  }: {
    item: RoomItem;
    name: string;
    onDeleted?: () => void;
  }) => (
    <div data-testid={`item-${item.id}`}>
      <span>{name}</span>
      <button type="button" onClick={() => onDeleted?.()}>
        Delete {name}
      </button>
    </div>
  ),
}));

vi.mock("@/hooks/use-grid-density", () => ({
  useGridDensity: () => ({
    frameWidth: 200,
    gap: 8,
    borderRadius: 8,
    fontScale: 1,
    containerRef: { current: null },
    hasHydrated: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The central item-detail dialog is exercised in its own test and pulls in the
// heavy item-card tree + React Query; stub it out here, capturing the handlers
// the room wires it so we can assert rename/delete reach the room's local state.
const dialogHandlers = vi.hoisted(() => ({
  onItemRenamed: null as ((id: string, title: string) => void) | null,
  onItemDeleted: null as ((id: string) => void) | null,
}));
vi.mock("@/app/(app)/dashboard/_components/central-item-dialog", () => ({
  CentralItemDialog: ({
    onItemRenamed,
    onItemDeleted,
  }: {
    onItemRenamed: (id: string, title: string) => void;
    onItemDeleted?: (id: string) => void;
  }) => {
    dialogHandlers.onItemRenamed = onItemRenamed;
    dialogHandlers.onItemDeleted = onItemDeleted ?? null;
    return null;
  },
}));

// Always-mounted dialog with its own data deps — stub it out
vi.mock("@/components/rooms/embed-stats-dialog", () => ({
  EmbedStatsDialog: () => null,
}));

import { RoomDetail } from "./room-detail";

const room: Room = {
  id: "room-1",
  name: "My Room",
  emoji: "📦",
  slug: "my-room",
  type: "manual",
  visibility: "private",
  filters: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  itemCount: 2,
};

const roomItem = (id: string, title: string): RoomItem =>
  ({ id, title, meta: {} }) as unknown as RoomItem;

function renderRoom() {
  return render(
    <RoomDetail
      room={room}
      initialItems={[roomItem("a", "Alpha"), roomItem("b", "Beta")]}
      initialCursor={null}
      initialHasMore={false}
    />,
  );
}

describe("RoomDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes an item and updates the header count when it reports being deleted", () => {
    renderRoom();

    expect(screen.getByTestId("item-a")).toBeInTheDocument();
    expect(screen.getByTestId("item-b")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();

    // ItemCard closes its own detail modal and calls onDeleted; the room view
    // must drop the item from its local list so the card stops rendering, and
    // keep the header count in sync with the grid.
    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha" }));

    expect(screen.queryByTestId("item-a")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-b")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("updates a card's title when the detail dialog renames it", () => {
    renderRoom();
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    act(() => dialogHandlers.onItemRenamed?.("a", "Alpha Renamed"));

    expect(screen.getByText("Alpha Renamed")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("removes a card when the detail dialog reports it deleted", () => {
    renderRoom();
    expect(screen.getByTestId("item-a")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();

    act(() => dialogHandlers.onItemDeleted?.("a"));

    expect(screen.queryByTestId("item-a")).not.toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("ignores a delete for an item not in the room (off-grid similar result)", () => {
    renderRoom();
    expect(screen.getByText("2 items")).toBeInTheDocument();

    // The dialog can delete an off-grid similar-images result not in this room;
    // the count must not drift.
    act(() => dialogHandlers.onItemDeleted?.("not-in-room"));

    expect(screen.getByTestId("item-a")).toBeInTheDocument();
    expect(screen.getByTestId("item-b")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });
});
