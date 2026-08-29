"use client";

import { ExternalLink, User } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserAvatarSetting } from "@/components/avatar/user-avatar-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { shouldCompleteProfile } from "@/lib/milestones/conditions";
import { BIO_MAX_LENGTH } from "@/lib/profile";
import { useMilestoneStore } from "@/stores/milestone-store";
import { useUserStore } from "@/stores/user-store";
import { requestEmailChange } from "../actions";

type ProfileSettingsProps = {
  firstName?: string | null;
  lastName?: string | null;
  website?: string | null;
  bio?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
  emailChanged?: boolean;
  showInvitedBy?: boolean;
  showInvited?: boolean;
};

export function ProfileSettings({
  firstName: initialFirstName,
  lastName: initialLastName,
  website: initialWebsite,
  bio: initialBio,
  username,
  email,
  initialAvatarUrl,
  emailChanged,
  showInvitedBy: initialShowInvitedBy = true,
  showInvited: initialShowInvited = true,
}: ProfileSettingsProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [website, setWebsite] = useState(initialWebsite ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [savedFirstName, setSavedFirstName] = useState(initialFirstName ?? "");
  const [savedLastName, setSavedLastName] = useState(initialLastName ?? "");
  const [savedWebsite, setSavedWebsite] = useState(initialWebsite ?? "");
  const [savedBio, setSavedBio] = useState(initialBio ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Public profile visibility toggles (saved immediately on change)
  const [showInvitedBy, setShowInvitedBy] = useState(initialShowInvitedBy);
  const [showInvited, setShowInvited] = useState(initialShowInvited);
  // Track pending toggles per field so an in-flight PATCH for one doesn't
  // re-enable the other
  const [savingToggles, setSavingToggles] = useState<
    Set<"showInvitedBy" | "showInvited">
  >(new Set());

  // Email change state
  const [newEmail, setNewEmail] = useState(email ?? "");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailState, emailAction, isEmailPending] = useActionState(
    requestEmailChange,
    {},
  );

  const { setFirstName: setStoreFirstName, setLastName: setStoreLastName } =
    useUserStore();

  const hasProfileChanges =
    firstName !== savedFirstName ||
    lastName !== savedLastName ||
    website !== savedWebsite ||
    bio !== savedBio;

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

  const handleToggleVisibility = async (
    field: "showInvitedBy" | "showInvited",
    value: boolean,
  ) => {
    const setLocal =
      field === "showInvitedBy" ? setShowInvitedBy : setShowInvited;
    // Optimistic update
    setLocal(value);
    setSavingToggles((prev) => new Set(prev).add(field));
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to update setting");
      }

      posthog.capture("profile_visibility_updated", { field, value });
    } catch (error) {
      // Revert on failure
      setLocal(!value);
      posthog.captureException(error);
      toast.error("Failed to update setting");
    } finally {
      setSavingToggles((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, website, bio }),
      });

      if (!response.ok) {
        const message =
          response.status === 400
            ? "Please enter a valid website URL"
            : "Failed to update profile";
        throw new Error(message);
      }

      const updated = await response.json();
      const normalizedWebsite = updated.website ?? "";
      const normalizedBio = updated.bio ?? "";

      // Capture which fields actually changed before we overwrite the saved state
      const updatedFields = [
        ...(firstName !== savedFirstName ? ["first_name"] : []),
        ...(lastName !== savedLastName ? ["last_name"] : []),
        ...(normalizedWebsite !== savedWebsite ? ["website"] : []),
        ...(normalizedBio !== savedBio ? ["bio"] : []),
      ];

      // Update local saved state to track changes; reflect the server-normalized
      // website (e.g. "example.com" saved as "https://example.com") and trimmed bio
      setSavedFirstName(firstName);
      setSavedLastName(lastName);
      setWebsite(normalizedWebsite);
      setSavedWebsite(normalizedWebsite);
      // Only reflect the normalized value if the field wasn't edited mid-save,
      // otherwise we'd discard the newer text the user typed while in flight
      setBio((currentBio) => (currentBio === bio ? normalizedBio : currentBio));
      setSavedBio(normalizedBio);

      // Update zustand store so header reflects changes immediately
      setStoreFirstName(firstName || null);
      setStoreLastName(lastName || null);

      // Mark milestone if profile is now complete
      // Use store avatarUrl (updated if user uploaded this session) with fallback to initial prop
      const currentAvatarUrl =
        useUserStore.getState().avatarUrl ?? initialAvatarUrl;
      if (
        shouldCompleteProfile({
          firstName,
          lastName,
          avatarUrl: currentAvatarUrl,
        })
      ) {
        useMilestoneStore.getState().markComplete("complete_profile");
      }

      // Track profile update event
      posthog.capture("profile_updated", {
        updated_fields: updatedFields,
      });

      toast.success("Profile updated");
    } catch (error) {
      posthog.captureException(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-xl">
            <User className="size-5 text-muted-foreground" />
            Profile
          </h3>
          <p className="mt-1 font-mono text-muted-foreground text-sm">
            Your avatar and name appear in shared or public rooms.
          </p>
        </div>
        {username && (
          <Link
            href={`/@${username}`}
            target="_blank"
            className="flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground text-sm hover:text-foreground"
          >
            View profile
            <ExternalLink className="size-4" />
          </Link>
        )}
      </div>

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
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              inputMode="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://your-site.com"
            />
            <p className="text-muted-foreground text-xs">
              Shown on your public profile.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX_LENGTH}
              rows={3}
              placeholder="A short line or two about you."
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Shown under your name on your public profile.
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {bio.length}/{BIO_MAX_LENGTH}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="showInvitedBy">Show who invited you</Label>
                <p className="text-muted-foreground text-xs">
                  Display who invited you on your public profile.
                </p>
              </div>
              <Switch
                id="showInvitedBy"
                checked={showInvitedBy}
                disabled={savingToggles.has("showInvitedBy")}
                onCheckedChange={(checked) =>
                  handleToggleVisibility("showInvitedBy", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="showInvited">Show who you invited</Label>
                <p className="text-muted-foreground text-xs">
                  When off, your profile shows just a count instead of the
                  individual people.
                </p>
              </div>
              <Switch
                id="showInvited"
                checked={showInvited}
                disabled={savingToggles.has("showInvited")}
                onCheckedChange={(checked) =>
                  handleToggleVisibility("showInvited", checked)
                }
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
              <p className="text-amber-600 text-xs">
                Pending verification — check your inbox
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Changing your email requires verification from both addresses.
              </p>
            )}
          </form>
          {hasProfileChanges && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveProfile}
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
