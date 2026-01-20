"use client";

import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatarSetting } from "@/components/avatar/user-avatar-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";

type ProfileSettingsProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
};

export function ProfileSettings({
  firstName: initialFirstName,
  lastName: initialLastName,
  username,
  email,
  initialAvatarUrl,
}: ProfileSettingsProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [savedFirstName, setSavedFirstName] = useState(initialFirstName ?? "");
  const [savedLastName, setSavedLastName] = useState(initialLastName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const hasNameChanges =
    firstName !== savedFirstName || lastName !== savedLastName;

  const handleSaveName = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      setSavedFirstName(firstName);
      setSavedLastName(lastName);

      // Track profile update event
      posthog.capture("profile_updated", {
        updated_fields: ["first_name", "last_name"],
      });

      toast.success("Profile updated");
    } catch (error) {
      posthog.captureException(error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold">Profile</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your avatar and name appear in shared or public rooms.
      </p>

      <div className="mt-4 flex items-start gap-4">
        <UserAvatarSetting
          firstName={firstName || undefined}
          lastName={lastName || undefined}
          username={username}
          email={email}
          initialAvatarUrl={initialAvatarUrl}
        />

        <div className="flex flex-1 flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
            />
          </div>
          {hasNameChanges && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveName}
              disabled={isSaving}
              className="self-start"
            >
              {isSaving ? <IsLoading label="Saving" /> : "Save changes"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
