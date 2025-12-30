import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { EditableTitle } from "@/components/ui/editable-title";

const EditableTitleDemo = ({
  initialValue = "Changelog Update",
  size = "lg",
  disabled = false,
  multiline = false,
}: {
  initialValue?: string;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  multiline?: boolean;
}) => {
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="max-w-xl">
      <EditableTitle
        value={value}
        size={size}
        disabled={disabled}
        multiline={multiline}
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

export const LongTitleInFixedContainer: Story = {
  args: {
    initialValue:
      "This is a very long title that should be constrained by the container width and not overflow beyond the fixed boundaries",
    size: "xl",
  },
  render: (args) => {
    const [value, setValue] = useState(args.initialValue ?? "");
    const [isSaving, setIsSaving] = useState(false);

    return (
      <div className="w-[400px] border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Fixed Width Container (400px)
        </h3>
        <EditableTitle
          value={value}
          size={args.size}
          disabled={args.disabled}
          onSubmit={async (next) => {
            setIsSaving(true);
            await new Promise((resolve) => setTimeout(resolve, 400));
            setValue(next);
            setIsSaving(false);
          }}
          isSaving={isSaving}
        />
        <p className="text-sm text-muted-foreground mt-4">
          Current value: <span className="font-medium">{value}</span>
        </p>
      </div>
    );
  },
};

export const Multiline: Story = {
  args: {
    initialValue: "A short title",
    size: "xl",
    multiline: true,
  },
};

export const MultilineWithLongText: Story = {
  args: {
    initialValue:
      "This is a very long title that will wrap to multiple lines when the multiline prop is enabled",
    size: "xl",
    multiline: true,
  },
  render: (args) => {
    const [value, setValue] = useState(args.initialValue ?? "");
    const [isSaving, setIsSaving] = useState(false);

    return (
      <div className="w-[400px] border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Fixed Width Container (400px) - Multiline
        </h3>
        <EditableTitle
          value={value}
          size={args.size}
          disabled={args.disabled}
          multiline={args.multiline}
          onSubmit={async (next) => {
            setIsSaving(true);
            await new Promise((resolve) => setTimeout(resolve, 400));
            setValue(next);
            setIsSaving(false);
          }}
          isSaving={isSaving}
        />
        <p className="text-sm text-muted-foreground mt-4">
          Press Enter to add new lines, Cmd/Ctrl+Enter to save
        </p>
      </div>
    );
  },
};
