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
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account settings.
          </p>
        </header>

        <div className="mt-8 flex gap-8">
          <aside className="w-48 shrink-0">
            <SettingsNav />
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
