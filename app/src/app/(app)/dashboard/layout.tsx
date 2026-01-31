import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { OnboardingWrapper } from "@/components/onboarding";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getOAuthMetadata } from "@/lib/supabase/user-metadata";
import { DashboardDropzone } from "../_components/dashboard-dropzone";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { user, metadata } = await getOAuthMetadata(supabase);

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
        <div className="flex min-h-0 flex-1 flex-col bg-background">
          <Suspense fallback={<div className="h-16" />}>
            <DashboardHeader showSearch />
          </Suspense>
          <div className="flex w-full flex-1 flex-col overflow-hidden px-4 py-2">
            {children}
          </div>
        </div>
      </DashboardDropzone>
    </OnboardingWrapper>
  );
}
