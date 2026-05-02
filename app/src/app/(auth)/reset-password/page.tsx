import { redirect } from "next/navigation";
import { needsMFAChallenge } from "@/lib/mfa";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  // Supabase requires AAL2 to call updateUser when MFA is enabled.
  // Send AAL1 users with a verified factor through the MFA challenge first.
  if (await needsMFAChallenge(supabase)) {
    redirect("/login/verify-mfa?next=/reset-password");
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            Set a new password
          </h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Choose a new password for your account
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </div>
  );
}
