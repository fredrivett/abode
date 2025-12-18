"use client";

import { Filter, Home, Sparkles, Upload, Users } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Step, Stepper, StepperNavigation } from "@/components/ui/stepper";

const ONBOARDING_STEPS = [
  {
    icon: Upload,
    title: "Upload images or paste articles",
    description:
      "Drag and drop images, or paste any URL to save articles. Abode accepts images and web content.",
  },
  {
    icon: Sparkles,
    title: "Automatic analysis",
    description:
      "Abode uses AI to analyze your content — extracting colors, objects, locations, and key details automatically.",
  },
  {
    icon: Filter,
    title: "Powerful filtering",
    description:
      "Search and filter by type, tags, content, colors, or location. Find exactly what you need instantly.",
  },
  {
    icon: Home,
    title: "Build your digital home",
    description:
      "Organize your visual life in one place. Everything is private and secure by default.",
  },
  {
    icon: Users,
    title: "Create smart rooms",
    description:
      'Group items into rooms for personal use or sharing. Create collections like "Vancouver photos 2025" effortlessly.',
  },
];

type OnboardingDialogProps = {
  open: boolean;
  onComplete: () => void;
};

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      await fetch("/api/v1/user/onboarding", { method: "PATCH" });
      onComplete();
    } catch {
      // Silently continue - onboarding should not block the user
      onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <Stepper onComplete={handleComplete}>
          {ONBOARDING_STEPS.map((step) => (
            <Step key={step.title}>
              <StepContent
                icon={step.icon}
                title={step.title}
                description={step.description}
              />
            </Step>
          ))}
          <StepperNavigation
            onSkip={handleComplete}
            skipLabel="Skip"
            nextLabel="Next"
            completeLabel={isCompleting ? "Finishing..." : "Get started"}
          />
        </Stepper>
      </DialogContent>
    </Dialog>
  );
}

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
    <DialogHeader className="text-center sm:text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-8 text-primary" />
      </div>
      <DialogTitle className="text-xl">{title}</DialogTitle>
      <DialogDescription className="text-base">{description}</DialogDescription>
    </DialogHeader>
  );
}
