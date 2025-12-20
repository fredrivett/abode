"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OnboardingDialog } from "./onboarding-dialog";

type UserMetadata = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type OnboardingWrapperProps = {
  showOnboarding: boolean;
  userMetadata?: UserMetadata;
  children: React.ReactNode;
};

export function OnboardingWrapper({
  showOnboarding,
  userMetadata,
  children,
}: OnboardingWrapperProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(showOnboarding);

  const handleComplete = () => {
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      {children}
      <OnboardingDialog
        open={isOpen}
        onComplete={handleComplete}
        userMetadata={userMetadata}
      />
    </>
  );
}
