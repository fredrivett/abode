import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardDropzone } from "../_components/dashboard-dropzone";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "./actions";

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  return trimmedValue;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: claims }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  if (!claims?.claims) {
    redirect("/login");
  }

  const claimsRecord = (claims.claims ?? {}) as Record<string, unknown>;
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
    <DashboardDropzone>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <Suspense fallback={<div className="h-16" />}>
          <DashboardHeader
            email={email}
            firstName={firstName}
            lastName={lastName}
            avatarUrl={avatarUrl}
            signOutAction={signOut}
          />
        </Suspense>
        <div className="w-full px-4 py-8">{children}</div>
      </div>
    </DashboardDropzone>
  );
}
