import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ api: { get: m.get, post: m.post } }));
vi.mock("posthog-js", () => ({
  default: { capture: m.capture, captureException: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AddToRoomPopover } from "./add-to-room-popover";

const ROOM = {
  id: "room-1",
  name: "Secret plans",
  emoji: null,
  itemCount: 0,
};

describe("AddToRoomPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.get.mockResolvedValue([ROOM]);
    m.post.mockResolvedValue({ room: { id: ROOM.id, name: ROOM.name } });
  });

  it("tracks adding to a room without the room's name", async () => {
    const onRoomsChange = vi.fn();
    render(
      <AddToRoomPopover
        itemId="item-1"
        currentRooms={[]}
        onRoomsChange={onRoomsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add to room/i }));
    fireEvent.click(await screen.findByRole("button", { name: ROOM.name }));

    await waitFor(() => expect(onRoomsChange).toHaveBeenCalled());
    expect(m.capture).toHaveBeenCalledWith("item_added_to_room", {
      item_id: "item-1",
      room_id: ROOM.id,
    });
    expect(JSON.stringify(m.capture.mock.calls)).not.toContain(ROOM.name);
  });
});
