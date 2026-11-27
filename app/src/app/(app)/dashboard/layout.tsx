import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardHeaderSkeleton } from "@/components/layout/dashboard-header/skeleton";
import { OnboardingWrapper } from "@/components/onboarding";
import { InstallAppBanner } from "@/components/pwa/install-app-banner";
import db from "@/lib/db";
import { getOAuthMetadata } from "@/lib/supabase/user-metadata";
import { DashboardDropzone } from "../_components/dashboard-dropzone";
import { DashboardShell } from "./dashboard-shell";

/**
 * Layout wrapping all dashboard pages.
 *
 * Verifies authentication, redirects to complete-signup if username is missing,
 * and wraps children in the onboarding dialog and full-page dropzone.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, metadata } = await getOAuthMetadata();

  if (!user) {
    redirect("/login");
  }

  // Fetch user from database to get onboarding status, username, avatar, and name
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      onboardingCompletedAt: true,
      username: true,
      avatarUrl: true,
      firstName: true,
      lastName: true,
    },
  });

  const showOnboarding =
    dbUser !== null && dbUser.onboardingCompletedAt === null;

  return (
    <OnboardingWrapper
      showOnboarding={showOnboarding}
      userMetadata={{
        firstName: dbUser?.firstName ?? metadata.firstName,
        lastName: dbUser?.lastName ?? metadata.lastName,
        username: dbUser?.username,
        email: metadata.email,
        avatarUrl: dbUser?.avatarUrl ?? null,
      }}
    >
      <DashboardDropzone>
        <DashboardShell
          header={
            <Suspense fallback={<DashboardHeaderSkeleton />}>
              <DashboardHeader showSearch />
            </Suspense>
          }
        >
          {children}
        </DashboardShell>
        <InstallAppBanner />
      </DashboardDropzone>
    </OnboardingWrapper>
  );
}
