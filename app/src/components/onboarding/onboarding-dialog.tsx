"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { IsLoading } from "@/components/ui/is-loading";
import { Kbd } from "@/components/ui/kbd";
import { getModifierKeySymbol, matchesShortcut } from "@/lib/keyboard";
import { ProfileStep } from "./profile-step";

type UserMetadata = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

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

  const handleComplete = useCallback(async () => {
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
      onComplete();
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, onComplete]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, { key: "Enter", modifier: true })) {
        e.preventDefault();
        void handleComplete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleComplete]);

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
            Complete your profile to get started
          </DialogDescription>
        </VisuallyHidden.Root>
        <DialogBody className="py-6">
          <ProfileStep
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
          <div className="mt-6 flex justify-end">
            <Button onClick={handleComplete}>
              {isCompleting ? <IsLoading label="Finishing" /> : "That's me"}
              <Kbd variant="primary">{getModifierKeySymbol()}</Kbd>
              <Kbd variant="primary">↵</Kbd>
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
