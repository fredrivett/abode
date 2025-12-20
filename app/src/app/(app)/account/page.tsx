import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import db from "@/lib/db";
import { getDisplayName } from "@/lib/get-display-name";
import { getInitials } from "@/lib/get-initials";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";

export default async function AccountPage() {
  const supabase = await createClient();
  const { user, metadata } = await getUserWithMetadata(supabase);

  if (!user) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true },
  });

  const { email, firstName, lastName, avatarUrl } = metadata;
  const username = dbUser?.username || null;
  const displayEmail = email || "Account";
  const displayName = getDisplayName({ firstName, lastName, username });
  const initials = getInitials({ firstName, lastName, fallback: displayName });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader
        email={email}
        firstName={firstName}
        lastName={lastName}
        username={username}
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
