import { redirect } from "next/navigation";
import { DashboardHeader } from "../_components/dashboard-header";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: claims }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  if (!claims?.claims) {
    redirect("/login");
  }

  const email =
    (claims?.claims?.email as string | undefined) ??
    userData.user?.email ??
    "Account";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader email={email} signOutAction={signOut} />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
