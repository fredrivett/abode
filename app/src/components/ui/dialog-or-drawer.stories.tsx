import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerClose,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerFooter,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
  DialogOrDrawerTrigger,
} from "@/components/ui/dialog-or-drawer";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/DialogOrDrawer",
  component: DialogOrDrawer,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof DialogOrDrawer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DialogOrDrawer>
      <DialogOrDrawerTrigger asChild>
        <Button variant="outline">Edit profile</Button>
      </DialogOrDrawerTrigger>
      <DialogOrDrawerContent>
        <DialogOrDrawerHeader>
          <DialogOrDrawerTitle>Edit profile</DialogOrDrawerTitle>
          <DialogOrDrawerDescription>
            Update your public details here. Shows as a dialog on desktop, drawer on mobile.
          </DialogOrDrawerDescription>
        </DialogOrDrawerHeader>
        <DialogOrDrawerBody className="grid gap-4">
          <div className="grid gap-2">
            <label className="font-medium text-sm leading-none" htmlFor="name">
              Name
            </label>
            <Input id="name" defaultValue="Aubrey Collins" />
          </div>
          <div className="grid gap-2">
            <label
              className="font-medium text-sm leading-none"
              htmlFor="username"
            >
              Username
            </label>
            <Input id="username" defaultValue="@aubrey" />
          </div>
        </DialogOrDrawerBody>
        <DialogOrDrawerFooter>
          <DialogOrDrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogOrDrawerClose>
          <Button>Save changes</Button>
        </DialogOrDrawerFooter>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  ),
};
