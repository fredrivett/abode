import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  return trimmedValue;
}

export default async function AccountPage() {
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

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayEmail = email || "Account";
  const displayName = fullName || "Account";
  const initials = getInitials({ firstName, lastName, fallback: displayName });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        email={email}
        firstName={firstName}
        lastName={lastName}
        avatarUrl={avatarUrl}
        signOutAction={signOut}
      />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
          <div className="flex flex-col gap-6">
            <header>
              <p className="text-sm text-muted-foreground">Settings</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Account
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your profile details.
              </p>
            </header>

            <section className="rounded-xl border p-4">
              <h3 className="text-sm font-medium">Profile</h3>
              <dl className="mt-4 grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Name</dt>
                  <dd className="text-sm font-medium">{displayName}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="text-sm font-medium">{displayEmail}</dd>
                </div>
              </dl>
            </section>
          </div>

          <aside className="md:sticky md:top-6">
            <div className="rounded-xl border p-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="size-16">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="mt-3">
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {displayEmail}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
