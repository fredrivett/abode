import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import db from "@/lib/db";
import { getMFAFactors } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import type { PreviousUsername } from "@/lib/username";
import { DeleteAccountSettings } from "./_components/delete-account-settings";
import { InviteSettings } from "./_components/invite-settings";
import { ProfileSettings } from "./_components/profile-settings";
import { SecuritySettings } from "./_components/security-settings";
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
      invitesRemaining: true,
      sentInvites: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          createdAt: true,
          expiresAt: true,
          acceptedAt: true,
        },
      },
    },
  });

  const { email } = metadata;
  // Prefer DB values over OAuth metadata for firstName/lastName
  const firstName = dbUser?.firstName ?? metadata.firstName;
  const lastName = dbUser?.lastName ?? metadata.lastName;

  const previousUsernames =
    (dbUser?.previousUsernames as PreviousUsername[]) || [];

  // Fetch MFA factors for security settings
  const mfaFactors = await getMFAFactors(supabase);

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
          <InviteSettings
            invitesRemaining={dbUser?.invitesRemaining ?? 0}
            initialInvites={(dbUser?.sentInvites ?? []).map((invite) => ({
              ...invite,
              createdAt: invite.createdAt.toISOString(),
              expiresAt: invite.expiresAt.toISOString(),
              acceptedAt: invite.acceptedAt?.toISOString() ?? null,
              status: invite.acceptedAt
                ? "accepted"
                : invite.expiresAt < new Date()
                  ? "expired"
                  : "pending",
            }))}
          />
          <SecuritySettings initialFactors={mfaFactors} />
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
