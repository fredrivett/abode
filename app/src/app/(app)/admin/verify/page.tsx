import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import db from "@/lib/db";
import { getAAL, getVerifiedTOTPFactor } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { AdminVerifyForm } from "./admin-verify-form";

export default async function AdminVerifyPage() {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    redirect("/dashboard");
  }

  // Check AAL level
  const aal = await getAAL(supabase);

  // If already at aal2, redirect to admin dashboard
  if (aal.currentLevel === "aal2") {
    redirect("/admin");
  }

  // If no MFA factor, redirect to settings to set it up
  if (!aal.hasVerifiedFactor) {
    redirect("/settings?setup=mfa");
  }

  // Get the verified factor for the challenge
  const factor = await getVerifiedTOTPFactor(supabase);
  if (!factor) {
    redirect("/settings?setup=mfa");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin verification
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your two-factor code to access the admin panel
            </p>
          </div>

          <AdminVerifyForm factorId={factor.id} />

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            <a
              href="/dashboard"
              className="font-medium text-gray-900 hover:underline dark:text-gray-100"
            >
              Back to dashboard
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
