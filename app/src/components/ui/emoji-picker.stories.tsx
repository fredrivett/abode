"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const meta = {
  title: "UI/EmojiPicker",
  component: EmojiPicker,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof EmojiPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

const EmojiPickerDemo = ({
  showFooter = false,
  height = "342px",
  width = "352px",
}: {
  showFooter?: boolean;
  height?: string;
  width?: string;
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-4">
      <EmojiPicker
        className="rounded-lg border shadow-md"
        style={{ height, width }}
        onEmojiSelect={({ emoji }) => {
          setSelectedEmoji(emoji);
        }}
      >
        <EmojiPickerSearch placeholder="Search emoji..." />
        <EmojiPickerContent />
        {showFooter && <EmojiPickerFooter />}
      </EmojiPicker>
      {selectedEmoji && (
        <p className="text-sm text-muted-foreground">
          Selected: {selectedEmoji}
        </p>
      )}
    </div>
  );
};

export const Default: Story = {
  render: () => <EmojiPickerDemo />,
};

export const WithFooter: Story = {
  render: () => <EmojiPickerDemo showFooter height="380px" />,
};

export const InPopover: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

    return (
      <div className="flex flex-col items-center gap-4">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-32">
              {selectedEmoji ?? "Pick emoji"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0" align="start">
            <EmojiPicker
              className="h-[342px]"
              onEmojiSelect={({ emoji }) => {
                setSelectedEmoji(emoji);
                setIsOpen(false);
              }}
            >
              <EmojiPickerSearch placeholder="Search emoji..." />
              <EmojiPickerContent />
            </EmojiPicker>
          </PopoverContent>
        </Popover>
        {selectedEmoji && (
          <p className="text-sm text-muted-foreground">
            Selected: {selectedEmoji}
          </p>
        )}
      </div>
    );
  },
};

export const Compact: Story = {
  render: () => <EmojiPickerDemo height="280px" width="300px" />,
};
