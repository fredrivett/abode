import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getAuthUser } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
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
