import type { Meta, StoryObj } from "@storybook/react";
import { Filter, Home, Sparkles, Upload, Users } from "lucide-react";
import { Step, Stepper, StepperNavigation } from "@/components/ui/stepper";

const meta = {
  title: "UI/Stepper",
  component: Stepper,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

function StepContent({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export const Default: Story = {
  args: { children: null },
  render: () => (
    <Stepper onComplete={() => alert("Completed!")}>
      <Step>
        <StepContent
          icon={Upload}
          title="Upload content"
          description="Drag and drop images or paste URLs"
        />
      </Step>
      <Step>
        <StepContent
          icon={Sparkles}
          title="Automatic analysis"
          description="AI analyzes your content automatically"
        />
      </Step>
      <Step>
        <StepContent
          icon={Filter}
          title="Filter and search"
          description="Find what you need instantly"
        />
      </Step>
      <StepperNavigation completeLabel="Get started" />
    </Stepper>
  ),
};

export const WithFiveSteps: Story = {
  args: { children: null },
  render: () => (
    <Stepper onComplete={() => alert("Onboarding completed!")}>
      <Step>
        <StepContent
          icon={Upload}
          title="Upload images or paste articles"
          description="Drag and drop images, or paste any URL to save articles."
        />
      </Step>
      <Step>
        <StepContent
          icon={Sparkles}
          title="Automatic analysis"
          description="Abode uses AI to analyze your content automatically."
        />
      </Step>
      <Step>
        <StepContent
          icon={Filter}
          title="Powerful filtering"
          description="Search by type, tags, content, colors, or location."
        />
      </Step>
      <Step>
        <StepContent
          icon={Home}
          title="Build your digital home"
          description="Organize your visual life in one place."
        />
      </Step>
      <Step>
        <StepContent
          icon={Users}
          title="Create smart rooms"
          description="Group items into rooms for personal use or sharing."
        />
      </Step>
      <StepperNavigation completeLabel="Get started" />
    </Stepper>
  ),
};

export const TwoSteps: Story = {
  args: { children: null },
  render: () => (
    <Stepper onComplete={() => alert("Completed!")}>
      <Step>
        <StepContent
          icon={Upload}
          title="Step 1"
          description="First step content"
        />
      </Step>
      <Step>
        <StepContent
          icon={Sparkles}
          title="Step 2"
          description="Second step content"
        />
      </Step>
      <StepperNavigation completeLabel="Finish" />
    </Stepper>
  ),
};
