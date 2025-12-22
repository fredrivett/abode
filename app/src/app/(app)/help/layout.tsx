import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { HelpNav } from "./_components/help-nav";

export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <Suspense fallback={<div className="h-16" />}>
        <DashboardHeader showHomeLink />
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
