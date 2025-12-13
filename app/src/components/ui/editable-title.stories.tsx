import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { EditableTitle } from "@/components/ui/editable-title";

const EditableTitleDemo = ({
  initialValue = "Changelog Update",
  size = "lg",
  disabled = false,
}: {
  initialValue?: string;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
}) => {
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="max-w-xl">
      <EditableTitle
        value={value}
        size={size}
        disabled={disabled}
        onSubmit={async (next) => {
          setIsSaving(true);
          await new Promise((resolve) => setTimeout(resolve, 400));
          setValue(next);
          setIsSaving(false);
        }}
        isSaving={isSaving}
      />
      <p className="text-sm text-muted-foreground mt-2">
        Current value: <span className="font-medium">{value}</span>
      </p>
    </div>
  );
};

const meta = {
  title: "Components/UI/Editable Title",
  component: EditableTitleDemo,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg", "xl"],
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof EditableTitleDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialValue: "Changelog Update",
    size: "lg",
  },
};

export const Disabled: Story = {
  args: {
    initialValue: "Changelog Update",
    size: "lg",
    disabled: true,
  },
};
