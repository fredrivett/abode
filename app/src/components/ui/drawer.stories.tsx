import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Drawer",
  component: Drawer,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Drawer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>Update your public details here</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid gap-4">
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
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
          <Button>Save changes</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
