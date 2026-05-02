import { redirect } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { getAAL, getVerifiedTOTPFactor } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { VerifyMFAForm } from "./verify-mfa-form";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function VerifyMFAPage({ searchParams }: Props) {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { next } = await searchParams;
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // Check AAL level
  const aal = await getAAL(supabase);

  // If already at aal2, redirect to next destination
  if (aal.currentLevel === "aal2") {
    redirect(safeNext);
  }

  // If no MFA factor, something went wrong - redirect to next destination
  if (!aal.hasVerifiedFactor) {
    redirect(safeNext);
  }

  // Get the verified factor for the challenge
  const factor = await getVerifiedTOTPFactor(supabase);
  if (!factor) {
    redirect(safeNext);
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            Two-factor authentication
          </h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Enter the code from your authenticator app
          </p>
        </div>

        <VerifyMFAForm factorId={factor.id} next={safeNext} />

        <p className="text-center text-gray-500 text-sm dark:text-gray-400">
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
