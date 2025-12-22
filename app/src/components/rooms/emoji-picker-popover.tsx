"use client";

import { DoorOpen } from "lucide-react";
import { useState } from "react";
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

type EmojiPickerPopoverProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
};

export function EmojiPickerPopover({
  value,
  onChange,
}: EmojiPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          {value ?? <DoorOpen className="size-5 text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="start">
        <EmojiPicker
          className="h-[342px]"
          onEmojiSelect={({ emoji }) => {
            onChange(emoji);
            setIsOpen(false);
          }}
        >
          <EmojiPickerSearch placeholder="Search emoji..." />
          <EmojiPickerContent />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}
