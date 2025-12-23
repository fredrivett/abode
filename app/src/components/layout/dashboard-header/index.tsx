import type { ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import db from "@/lib/db";
import { getAvailableInvites } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import { DashboardHeaderClient } from "./client";

type DashboardHeaderProps = {
  showSearch?: boolean;
  showHomeLink?: boolean;
  /** Optional custom content for the center slot (replaces search input) */
  centerSlot?: ReactNode;
};

export async function DashboardHeader({
  showSearch = false,
  showHomeLink = false,
  centerSlot,
}: DashboardHeaderProps = {}) {
  const supabase = await createClient();
  const { user, metadata } = await getUserWithMetadata(supabase);

  // Get user profile from DB (takes priority over OAuth metadata)
  const [dbUser, availableInvites] = user
    ? await Promise.all([
        db.user.findUnique({
          where: { id: user.id },
          select: {
            username: true,
            avatarUrl: true,
            firstName: true,
            lastName: true,
          },
        }),
        getAvailableInvites(user.id),
      ])
    : [null, 0];

  // If no user, show unauthenticated header
  if (!user) {
    return (
      <DashboardHeaderClient
        isAuthenticated={false}
        showSearch={false}
        showHomeLink={showHomeLink}
        centerSlot={centerSlot}
      />
    );
  }

  return (
    <DashboardHeaderClient
      isAuthenticated
      email={metadata.email}
      firstName={dbUser?.firstName ?? metadata.firstName}
      lastName={dbUser?.lastName ?? metadata.lastName}
      username={dbUser?.username ?? metadata.username}
      avatarUrl={dbUser?.avatarUrl ?? metadata.avatarUrl}
      availableInvites={availableInvites}
      signOutAction={signOut}
      showSearch={showSearch}
      showHomeLink={showHomeLink}
      centerSlot={centerSlot}
    />
  );
}
