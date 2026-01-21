"use client";

import posthog from "posthog-js";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserAvatarSetting } from "@/components/avatar/user-avatar-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/stores/user-store";
import { requestEmailChange } from "../actions";

type ProfileSettingsProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
  emailChanged?: boolean;
};

export function ProfileSettings({
  firstName: initialFirstName,
  lastName: initialLastName,
  username,
  email,
  initialAvatarUrl,
  emailChanged,
}: ProfileSettingsProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [savedFirstName, setSavedFirstName] = useState(initialFirstName ?? "");
  const [savedLastName, setSavedLastName] = useState(initialLastName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState(email ?? "");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailState, emailAction, isEmailPending] = useActionState(
    requestEmailChange,
    {},
  );

  const { setFirstName: setStoreFirstName, setLastName: setStoreLastName } =
    useUserStore();

  const hasNameChanges =
    firstName !== savedFirstName || lastName !== savedLastName;

  const hasEmailChanged =
    newEmail.trim().toLowerCase() !== (email ?? "").toLowerCase();

  // Show success toast if redirected after email change verification
  useEffect(() => {
    if (emailChanged) {
      setPendingEmail(null);
      setNewEmail(email ?? "");
      toast.success("Email address updated successfully");
      // Remove the query param from URL without triggering navigation
      window.history.replaceState({}, "", "/settings/account");
    }
  }, [emailChanged, email]);

  // Handle email change result
  useEffect(() => {
    if (emailState.error) {
      toast.error(emailState.error);
    }
    if (emailState.success) {
      setPendingEmail(newEmail);
      toast.success(
        "Verification emails sent to both addresses. Check your inbox.",
      );
    }
  }, [emailState, newEmail]);

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
          <form action={emailAction} className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                name="email"
                type="email"
                value={pendingEmail ?? newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1"
                disabled={!!pendingEmail || isEmailPending}
              />
              {hasEmailChanged && !pendingEmail && (
                <Button type="submit" size="sm" disabled={isEmailPending}>
                  {isEmailPending ? <IsLoading label="Sending" /> : "Update"}
                </Button>
              )}
            </div>
            {pendingEmail ? (
              <p className="text-xs text-amber-600">
                Pending verification — check your inbox
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Changing your email requires verification from both addresses.
              </p>
            )}
          </form>
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
