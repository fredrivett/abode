import { describe, expect, it } from "vitest";
import { canViewRoom, viewableRoomItemsWhere } from "./room-access";

describe("canViewRoom", () => {
  const room = (visibility: "public" | "private") => ({
    userId: "owner",
    visibility,
  });

  it("lets the owner view their room whatever its visibility", () => {
    expect(canViewRoom({ room: room("private"), viewerId: "owner" })).toBe(
      true,
    );
    expect(canViewRoom({ room: room("public"), viewerId: "owner" })).toBe(true);
  });

  it("lets anyone view a public room, signed in or not", () => {
    expect(canViewRoom({ room: room("public"), viewerId: "someone" })).toBe(
      true,
    );
    expect(canViewRoom({ room: room("public"), viewerId: null })).toBe(true);
  });

  it("hides a private room from everyone but its owner", () => {
    expect(canViewRoom({ room: room("private"), viewerId: "someone" })).toBe(
      false,
    );
    expect(canViewRoom({ room: room("private"), viewerId: null })).toBe(false);
  });
});

describe("viewableRoomItemsWhere", () => {
  it("gives the owner every item", () => {
    expect(viewableRoomItemsWhere({ roomId: "r", isOwner: true })).toEqual({
      roomId: "r",
    });
  });

  it("gives others only items not excluded from public rooms", () => {
    expect(viewableRoomItemsWhere({ roomId: "r", isOwner: false })).toEqual({
      roomId: "r",
      item: { excludeFromPublicRooms: false },
    });
  });
});
