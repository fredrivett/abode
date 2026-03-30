import { redirect } from "next/navigation";
import { hasCompletedSignup } from "@/lib/auth/has-completed-signup";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Root layout for authenticated app routes.
 *
 * Verifies the user is authenticated and has completed signup (has a username).
 * Redirects to `/login` or `/complete-signup` as needed.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const signupComplete = await hasCompletedSignup(user.id);
  if (!signupComplete) {
    redirect(ROUTES.COMPLETE_SIGNUP);
  }

  return <>{children}</>;
}
