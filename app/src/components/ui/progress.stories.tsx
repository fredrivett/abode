import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";

import { Progress } from "@/components/ui/progress";

const meta = {
  title: "UI/Progress",
  component: Progress,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[300px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
  },
};

export const Empty: Story = {
  args: {
    value: 0,
  },
};

export const Complete: Story = {
  args: {
    value: 100,
  },
};

export const NoRadius: Story = {
  args: {
    value: 60,
    className: "rounded-none h-1",
  },
};

export const Thin: Story = {
  args: {
    value: 70,
    className: "h-0.5",
  },
};

/**
 * Simulates the image loading behavior: quick animation to 50%, hold, then complete
 */
export const ImageLoading: Story = {
  render: function ImageLoadingStory() {
    const [value, setValue] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      // Animate to 50% quickly
      const quickTimer = setTimeout(() => setValue(50), 100);

      // Simulate image load completing after 2 seconds
      const loadTimer = setTimeout(() => {
        setIsLoaded(true);
        setValue(100);
      }, 2000);

      return () => {
        clearTimeout(quickTimer);
        clearTimeout(loadTimer);
      };
    }, []);

    if (isLoaded) {
      return (
        <div className="text-muted-foreground text-sm">
          Image loaded! (Progress bar hidden)
        </div>
      );
    }

    return <Progress value={value} className="h-0.5 rounded-none" />;
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-muted-foreground text-sm">Default (rounded)</p>
        <Progress value={60} />
      </div>
      <div>
        <p className="mb-2 text-muted-foreground text-sm">No radius</p>
        <Progress value={60} className="rounded-none" />
      </div>
      <div>
        <p className="mb-2 text-muted-foreground text-sm">Thin (h-0.5)</p>
        <Progress value={60} className="h-0.5" />
      </div>
      <div>
        <p className="mb-2 text-muted-foreground text-sm">
          Thin + No radius (for image loading)
        </p>
        <Progress value={60} className="h-0.5 rounded-none" />
      </div>
    </div>
  ),
};
