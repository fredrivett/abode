import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserMetadata } from "@/lib/supabase/user-metadata";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";
import { HelpNav } from "./_components/help-nav";

export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const metadata = await getUserMetadata(supabase);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Suspense fallback={<div className="h-16" />}>
        <DashboardHeader
          email={metadata.email}
          firstName={metadata.firstName}
          lastName={metadata.lastName}
          username={metadata.username}
          avatarUrl={metadata.avatarUrl}
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
