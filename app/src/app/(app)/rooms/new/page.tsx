import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../../_components/dashboard-header";
import { signOut } from "../../dashboard/actions";
import { NewRoomForm } from "./_components/new-room-form";

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  return trimmedValue;
}

export default async function NewRoomPage() {
  const supabase = await createClient();
  const [{ data: claims }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const claimsRecord = (claims?.claims ?? {}) as Record<string, unknown>;
  const claimsUserMetadata = (claimsRecord.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const userMetadata = (userData.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const email = getString(claimsRecord.email) ?? userData.user?.email ?? null;
  const firstName =
    getString(userMetadata.first_name) ??
    getString(userMetadata.given_name) ??
    getString(claimsRecord.given_name) ??
    getString(claimsUserMetadata.given_name) ??
    getString(claimsUserMetadata.first_name) ??
    null;
  const lastName =
    getString(userMetadata.last_name) ??
    getString(userMetadata.family_name) ??
    getString(claimsRecord.family_name) ??
    getString(claimsUserMetadata.family_name) ??
    getString(claimsUserMetadata.last_name) ??
    null;
  const avatarUrl: string | null =
    getString(userMetadata.avatar_url) ??
    getString(userMetadata.picture) ??
    getString(claimsRecord.picture) ??
    getString(claimsUserMetadata.picture) ??
    getString(claimsUserMetadata.avatar_url) ??
    null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        email={email}
        firstName={firstName}
        lastName={lastName}
        avatarUrl={avatarUrl}
        signOutAction={signOut}
        showHomeLink
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <NewRoomForm />
      </div>
    </div>
  );
}
