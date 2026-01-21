import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SettingsNav } from "./_components/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            Manage your account settings.
          </p>
        </header>

        <div className="mt-6 md:mt-8 md:flex md:items-start md:gap-8">
          <aside className="md:sticky md:top-20 md:w-48 md:shrink-0">
            <SettingsNav />
          </aside>

          <main className="mt-6 min-w-0 flex-1 md:mt-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
