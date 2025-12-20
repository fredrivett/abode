import { redirect } from "next/navigation";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import type { PreviousUsername } from "@/lib/username";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";
import { UsernameSettings } from "./_components/username-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true, previousUsernames: true },
  });

  const previousUsernames =
    (dbUser?.previousUsernames as PreviousUsername[]) || [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader signOutAction={signOut} />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account settings.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          <UsernameSettings
            currentUsername={dbUser?.username || null}
            changesUsed={previousUsernames.length}
          />
        </div>
      </div>
    </div>
  );
}
