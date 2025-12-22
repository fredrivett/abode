"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DoorOpen, Filter, Home, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AbodeInline } from "@/app/(app)/help/_components/abode-inline";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Step, Stepper, StepperNavigation } from "@/components/ui/stepper";
import { AvatarStep } from "./avatar-step";

type UserMetadata = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

const ONBOARDING_STEPS = [
  {
    icon: Upload,
    title: "Upload images & paste articles",
    description: (
      <>
        Drag and drop images, or paste any URL to save articles.
        <span className="translate-y-[0.025em]">
          <AbodeInline />
        </span>{" "}
        currently supports images and web content, with more coming soon.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: "Automatic analysis",
    description: (
      <>
        <span className="translate-y-[0.025em]">
          <AbodeInline />
        </span>{" "}
        automatically analyzes your content — extracting colors, objects,
        locations, and key details.
      </>
    ),
  },
  {
    icon: Filter,
    title: "Find things effortlessly",
    description:
      "Filter by type, tags, colors, or location — or just type to search in natural language.",
  },
  {
    icon: Home,
    title: "Build your digital home",
    description:
      "Organize your visual life in one place. Everything is private and secure by default.",
  },
  {
    icon: DoorOpen,
    title: "Smart rooms",
    description: (
      <>
        Automatically group items into smart rooms for personal use or sharing.
        Create collections like{" "}
        <Badge variant="secondary">Vancouver photos 2025</Badge> effortlessly.
      </>
    ),
  },
];

type OnboardingDialogProps = {
  open: boolean;
  onComplete: () => void;
  userMetadata?: UserMetadata;
};

export function OnboardingDialog({
  open,
  onComplete,
  userMetadata,
}: OnboardingDialogProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const firstNameRef = useRef(userMetadata?.firstName ?? "");
  const lastNameRef = useRef(userMetadata?.lastName ?? "");

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      await fetch("/api/v1/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstNameRef.current,
          lastName: lastNameRef.current,
        }),
      });
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
        <VisuallyHidden.Root>
          <DialogTitle>Welcome to Abode</DialogTitle>
          <DialogDescription>
            Learn how to use Abode to organize your digital life
          </DialogDescription>
        </VisuallyHidden.Root>
        <Stepper onComplete={handleComplete}>
          <Step key="avatar">
            <AvatarStep
              firstName={userMetadata?.firstName}
              lastName={userMetadata?.lastName}
              username={userMetadata?.username}
              email={userMetadata?.email}
              initialAvatarUrl={userMetadata?.avatarUrl}
              onFirstNameChange={(value) => {
                firstNameRef.current = value;
              }}
              onLastNameChange={(value) => {
                lastNameRef.current = value;
              }}
            />
          </Step>
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
            nextLabel="Next"
            completeLabel={isCompleting ? "Finishing..." : "Get started"}
            showKeyboardHints
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
  description: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold leading-none">{title}</h2>
      <p className="text-base text-muted-foreground">{description}</p>
    </div>
  );
}
