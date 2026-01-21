"use client";

import { User } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatarSetting } from "@/components/avatar/user-avatar-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/stores/user-store";

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

  const { setFirstName: setStoreFirstName, setLastName: setStoreLastName } =
    useUserStore();

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

      // Update local saved state to track changes
      setSavedFirstName(firstName);
      setSavedLastName(lastName);

      // Update zustand store so header reflects changes immediately
      setStoreFirstName(firstName || null);
      setStoreLastName(lastName || null);

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
      <h3 className="flex items-center gap-2 text-xl font-semibold">
        <User className="size-5 text-muted-foreground" />
        Profile
      </h3>
      <p className="mt-1 font-mono text-sm text-muted-foreground">
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
          <div className="grid gap-3 md:grid-cols-2">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email ?? ""}
              disabled
              className="bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Please contact support to change your email address.
            </p>
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
