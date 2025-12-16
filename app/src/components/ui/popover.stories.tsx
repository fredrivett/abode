"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const meta = {
  title: "UI/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-4">
          <h4 className="font-medium leading-none">Dimensions</h4>
          <div className="space-y-2">
            <div className="space-y-1">
              <label htmlFor="width" className="text-sm font-medium">
                Width
              </label>
              <Input id="width" placeholder="100" />
            </div>
            <div className="space-y-1">
              <label htmlFor="height" className="text-sm font-medium">
                Height
              </label>
              <Input id="height" placeholder="25" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const WithCustomWidth: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Settings</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Preferences</h4>
          <p className="text-sm text-muted-foreground">
            Adjust your settings and preferences here.
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm">Enable notifications</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4" />
              <span className="text-sm">Dark mode</span>
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignmentTop: Story = {
  render: () => (
    <div className="pt-40">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">Top Aligned</Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top">
          <p className="text-sm">Popover aligned to the top</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const AlignmentRight: Story = {
  render: () => (
    <div className="flex justify-center items-center min-h-64">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">Right Aligned</Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="right">
          <p className="text-sm">Popover aligned to the right</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const WithForm: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button>Add Filter</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Add New Filter</h4>
            <div className="space-y-2">
              <label htmlFor="filter-name" className="text-sm font-medium">
                Filter Name
              </label>
              <Input id="filter-name" placeholder="e.g., Active Users" />
            </div>
            <div className="space-y-2">
              <label htmlFor="filter-value" className="text-sm font-medium">
                Filter Value
              </label>
              <Input id="filter-value" placeholder="e.g., status:active" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
};

export const ControlledPopover: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={open ? "default" : "outline"}
            onClick={() => setOpen(!open)}
          >
            Toggle Popover
          </Button>
          <span className="text-sm text-muted-foreground pt-2">
            {open ? "Open" : "Closed"}
          </span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary">Trigger</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm">This popover is controlled externally.</p>
          </PopoverContent>
        </Popover>
      </div>
    );
  },
};
