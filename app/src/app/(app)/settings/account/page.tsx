import { redirect } from "next/navigation";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getMFAFactors } from "@/lib/mfa";
import { storedFilesForUser } from "@/lib/storage-usage";
import { createClient } from "@/lib/supabase/server";
import { getOAuthMetadata } from "@/lib/supabase/user-metadata";
import type { PreviousUsername } from "@/lib/username";
import { AccountStats } from "../_components/account-stats";
import { DeleteAccountSettings } from "../_components/delete-account-settings";
import { ProfileSettings } from "../_components/profile-settings";
import { SecuritySettings } from "../_components/security-settings";
import { UsernameSettings } from "../_components/username-settings";

const log = createLogger("settings/account");

type AccountSettingsPageProps = {
  searchParams: Promise<{ email_changed?: string }>;
};

export default async function AccountSettingsPage({
  searchParams,
}: AccountSettingsPageProps) {
  const { email_changed } = await searchParams;
  const supabase = await createClient();
  const { user, metadata } = await getOAuthMetadata(supabase);

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
      website: true,
      bio: true,
      showInvitedBy: true,
      showInvited: true,
      allowSearchIndexing: true,
      storageUsedBytes: true,
      itemCount: true,
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

  // Live from storage so files and bytes agree; fall back to the reconciled
  // counter (and no file count) if that read fails
  const storedFiles = await storedFilesForUser(user.id).catch((error) => {
    log.warn({ error, userId: user.id }, "Failed to read stored file stats");
    return null;
  });

  return (
    <div className="space-y-6">
      <ProfileSettings
        firstName={firstName}
        lastName={lastName}
        website={dbUser?.website}
        bio={dbUser?.bio}
        username={dbUser?.username}
        email={email}
        initialAvatarUrl={dbUser?.avatarUrl}
        emailChanged={email_changed === "true"}
        showInvitedBy={dbUser?.showInvitedBy ?? true}
        showInvited={dbUser?.showInvited ?? true}
        allowSearchIndexing={dbUser?.allowSearchIndexing ?? false}
      />
      <UsernameSettings
        currentUsername={dbUser?.username || null}
        changesUsed={previousUsernames.length}
      />
      <AccountStats
        storageUsedBytes={
          storedFiles?.bytes ?? dbUser?.storageUsedBytes ?? BigInt(0)
        }
        itemCount={dbUser?.itemCount ?? 0}
        fileCount={storedFiles?.fileCount ?? null}
      />
      <SecuritySettings initialFactors={mfaFactors} />
      <DeleteAccountSettings />
    </div>
  );
}
