import { redirect } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { getAAL, getVerifiedTOTPFactor } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { VerifyMFAForm } from "./verify-mfa-form";

export default async function VerifyMFAPage() {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check AAL level
  const aal = await getAAL(supabase);

  // If already at aal2, redirect to dashboard
  if (aal.currentLevel === "aal2") {
    redirect("/dashboard");
  }

  // If no MFA factor, something went wrong - redirect to dashboard
  if (!aal.hasVerifiedFactor) {
    redirect("/dashboard");
  }

  // Get the verified factor for the challenge
  const factor = await getVerifiedTOTPFactor(supabase);
  if (!factor) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Two-factor authentication
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter the code from your authenticator app
          </p>
        </div>

        <VerifyMFAForm factorId={factor.id} />

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          <form action={signOut} className="inline">
            <button
              type="submit"
              className="font-medium text-gray-900 hover:underline dark:text-gray-100"
            >
              Back to login
            </button>
          </form>
        </p>
      </div>
    </div>
  );
}
