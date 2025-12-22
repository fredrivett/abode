import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import type { PreviousUsername } from "@/lib/username";
import { DeleteAccountSettings } from "./_components/delete-account-settings";
import { ProfileSettings } from "./_components/profile-settings";
import { UsernameSettings } from "./_components/username-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { user, metadata } = await getUserWithMetadata(supabase);

  if (!user) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      username: true,
      previousUsernames: true,
      avatarUrl: true,
      firstName: true,
      lastName: true,
    },
  });

  const { email } = metadata;
  // Prefer DB values over OAuth metadata for firstName/lastName
  const firstName = dbUser?.firstName ?? metadata.firstName;
  const lastName = dbUser?.lastName ?? metadata.lastName;

  const previousUsernames =
    (dbUser?.previousUsernames as PreviousUsername[]) || [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account settings.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          <ProfileSettings
            firstName={firstName}
            lastName={lastName}
            username={dbUser?.username}
            email={email}
            initialAvatarUrl={dbUser?.avatarUrl}
          />
          <UsernameSettings
            currentUsername={dbUser?.username || null}
            changesUsed={previousUsernames.length}
          />
          <DeleteAccountSettings />
        </div>
      </div>
    </div>
  );
}
