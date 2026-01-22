"use client";

import { useState } from "react";
import { AbodeInline } from "@/app/(app)/help/_components/abode-inline";
import { UserAvatarSetting } from "@/components/avatar/user-avatar-setting";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileStepProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
  onFirstNameChange?: (firstName: string) => void;
  onLastNameChange?: (lastName: string) => void;
};

export function ProfileStep({
  firstName: initialFirstName,
  lastName: initialLastName,
  username,
  email,
  initialAvatarUrl,
  onFirstNameChange,
  onLastNameChange,
}: ProfileStepProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFirstName(value);
    onFirstNameChange?.(value);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLastName(value);
    onLastNameChange?.(value);
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-pretty font-semibold text-lg leading-none">
        Who's moving in?
      </h2>
      <p className="text-pretty text-base text-muted-foreground">
        Make <AbodeInline /> your own by completing your profile.
      </p>

      <div className="mt-2 flex w-full items-start gap-4">
        <UserAvatarSetting
          firstName={firstName || undefined}
          lastName={lastName || undefined}
          username={username}
          email={email}
          initialAvatarUrl={initialAvatarUrl}
        />

        <div className="flex flex-1 flex-col gap-3 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={handleFirstNameChange}
              placeholder="Jane"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={handleLastNameChange}
              placeholder="Doe"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
