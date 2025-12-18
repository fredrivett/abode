import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";
import { HelpNav } from "./_components/help-nav";

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  return trimmedValue;
}

export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const email = getString(claimsRecord.email) ?? userData.user?.email;
  const firstName =
    getString(userMetadata.first_name) ??
    getString(userMetadata.given_name) ??
    getString(claimsRecord.given_name) ??
    getString(claimsUserMetadata.given_name) ??
    getString(claimsUserMetadata.first_name);
  const lastName =
    getString(userMetadata.last_name) ??
    getString(userMetadata.family_name) ??
    getString(claimsRecord.family_name) ??
    getString(claimsUserMetadata.family_name) ??
    getString(claimsUserMetadata.last_name);
  const avatarUrl =
    getString(userMetadata.avatar_url) ??
    getString(userMetadata.picture) ??
    getString(claimsRecord.picture) ??
    getString(claimsUserMetadata.picture) ??
    getString(claimsUserMetadata.avatar_url);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Suspense fallback={<div className="h-16" />}>
        <DashboardHeader
          email={email}
          firstName={firstName}
          lastName={lastName}
          avatarUrl={avatarUrl}
          signOutAction={signOut}
          showSearch={false}
          showHomeLink={true}
        />
      </Suspense>
      <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <HelpNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
