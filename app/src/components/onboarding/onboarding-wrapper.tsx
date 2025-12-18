"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OnboardingDialog } from "./onboarding-dialog";

type OnboardingWrapperProps = {
  showOnboarding: boolean;
  children: React.ReactNode;
};

export function OnboardingWrapper({
  showOnboarding,
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
      <OnboardingDialog open={isOpen} onComplete={handleComplete} />
    </>
  );
}
