import { redirect } from "next/navigation";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { CompleteSignupForm } from "./complete-signup-form";

export default async function CompleteSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in or missing email, redirect to login
  if (!user || !user.email) {
    redirect("/login");
  }

  // Check if user already has a username
  const existingUser = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true },
  });

  // If username is already set, redirect to dashboard
  if (existingUser?.username) {
    redirect("/dashboard");
  }

  // Get metadata for any invite info
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const inviteToken = metadata?.invite_token as string | undefined;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            complete your profile
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            just one more step - choose your username
          </p>
        </div>

        <CompleteSignupForm email={user.email} inviteToken={inviteToken} />
      </div>
    </div>
  );
}
