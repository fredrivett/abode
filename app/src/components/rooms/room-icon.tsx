import { DoorOpen } from "lucide-react";

/**
 * The default icon used for rooms without a custom emoji.
 * Import this constant wherever you need to render a room icon.
 *
 * Usage:
 * ```tsx
 * import { RoomIcon } from "@/components/rooms/room-icon";
 *
 * // With default styling
 * <RoomIcon className="size-4" />
 *
 * // Or for conditional rendering with emoji
 * {room.emoji ? <span>{room.emoji}</span> : <RoomIcon className="size-4 text-muted-foreground" />}
 * ```
 */
export const RoomIcon = DoorOpen;
