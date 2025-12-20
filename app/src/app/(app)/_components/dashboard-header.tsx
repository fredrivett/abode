import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import { signOut } from "../dashboard/actions";
import { DashboardHeaderClient } from "./dashboard-header-client";

type DashboardHeaderProps = {
  showSearch?: boolean;
  showHomeLink?: boolean;
};

export async function DashboardHeader({
  showSearch = false,
  showHomeLink = false,
}: DashboardHeaderProps = {}) {
  const supabase = await createClient();
  const { user, metadata } = await getUserWithMetadata(supabase);

  // Get username and avatarUrl from DB (these take priority)
  const dbUser = user
    ? await db.user.findUnique({
        where: { id: user.id },
        select: { username: true, avatarUrl: true },
      })
    : null;

  return (
    <DashboardHeaderClient
      email={metadata.email}
      firstName={metadata.firstName}
      lastName={metadata.lastName}
      username={dbUser?.username ?? metadata.username}
      avatarUrl={dbUser?.avatarUrl ?? metadata.avatarUrl}
      signOutAction={signOut}
      showSearch={showSearch}
      showHomeLink={showHomeLink}
    />
  );
}
