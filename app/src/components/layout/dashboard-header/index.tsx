import type { ReactNode } from "react";
import { Suspense } from "react";
import { signOut } from "@/lib/actions/auth";
import { getAuthenticatedUser } from "@/lib/user";
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
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <Suspense>
        <DashboardHeaderClient
          isAuthenticated={false}
          showSearch={false}
          showHomeLink={showHomeLink}
          centerSlot={centerSlot}
        />
      </Suspense>
    );
  }

  // Pass user data as props for SSR (zustand stores return initial values during SSR).
  // The client component hydrates these into the store for client-side reactivity.
  return (
    <Suspense>
      <DashboardHeaderClient
        isAuthenticated
        email={user.email}
        firstName={user.firstName}
        lastName={user.lastName}
        username={user.username}
        avatarUrl={user.avatarUrl}
        isAdmin={user.isAdmin}
        availableInvites={user.availableInvites}
        signOutAction={signOut}
        showSearch={showSearch}
        showHomeLink={showHomeLink}
        centerSlot={centerSlot}
      />
    </Suspense>
  );
}
