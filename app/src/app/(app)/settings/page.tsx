import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";

export default async function SettingsPage() {
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

        <section className="mt-8 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">
            Settings options coming soon.
          </p>
        </section>
      </div>
    </div>
  );
}
