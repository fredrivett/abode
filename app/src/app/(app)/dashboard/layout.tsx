import { redirect } from "next/navigation";
import { DashboardHeader } from "../_components/dashboard-header";
import { DashboardDropzone } from "../_components/dashboard-dropzone";
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
    <DashboardDropzone>
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="mx-auto flex w-full max-w-5xl px-4 py-4">
            <DashboardHeader email={email} signOutAction={signOut} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>
      </div>
    </DashboardDropzone>
  );
}
