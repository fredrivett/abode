"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { RoomIcon } from "@/components/rooms/room-icon";
import { Button } from "@/components/ui/button";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type EmojiPickerPopoverProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
  /** Optional placeholder emoji shown at 50% opacity when no value is set */
  placeholderEmoji?: string | null;
  /** Whether the placeholder is currently transitioning (fading) */
  isTransitioning?: boolean;
  /** Callback fired after an emoji is selected (not on remove) */
  onSelect?: () => void;
};

export function EmojiPickerPopover({
  value,
  onChange,
  placeholderEmoji,
  isTransitioning = false,
  onSelect,
}: EmojiPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine what to show in the button
  const renderButtonContent = () => {
    if (value) {
      return value;
    }
    // When no value is selected, show either the placeholder emoji or default icon
    // Both should fade during transitions
    return (
      <span
        className={cn(
          "transition-opacity duration-300",
          isTransitioning
            ? "opacity-0"
            : placeholderEmoji
              ? "opacity-50"
              : "opacity-100",
        )}
      >
        {placeholderEmoji ?? (
          <RoomIcon className="size-5 text-muted-foreground" />
        )}
      </span>
    );
  };

  const handleRemove = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 text-xl"
          aria-label={value ? `Change emoji: ${value}` : "Add emoji"}
        >
          {renderButtonContent()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="start">
        <EmojiPicker
          className="h-[342px]"
          onEmojiSelect={({ emoji }) => {
            onChange(emoji);
            setIsOpen(false);
            onSelect?.();
          }}
        >
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <EmojiPickerSearch
              placeholder="Search emoji..."
              className="border-0 px-1"
            />
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
                Remove
              </Button>
            )}
          </div>
          <EmojiPickerContent />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}
