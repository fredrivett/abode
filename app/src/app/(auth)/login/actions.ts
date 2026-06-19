"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { hasCompletedSignup } from "@/lib/auth/has-completed-signup";
import { getAAL } from "@/lib/mfa";
import { getPostHogClient } from "@/lib/posthog-server";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/url-utils";

export type AuthResult = {
  error?: string;
  success?: boolean;
};

export async function login(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const next = formData.get("next");
  const safeNext = getSafeRedirectPath(typeof next === "string" ? next : null);

  const { data: authData, error } =
    await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: error.message };
  }

  // Log login activity (fire-and-forget)
  if (authData.user) {
    void logActivity(authData.user.id, "user_login");

    // Track login event with PostHog
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: authData.user.id,
      event: "user_logged_in",
      properties: {
        email: data.email,
        source: "password",
      },
    });
    posthog?.identify({
      distinctId: authData.user.id,
      properties: {
        email: data.email,
      },
    });
  }

  // Check if user has MFA enabled and needs to complete challenge
  const aal = await getAAL(supabase);
  if (aal.hasVerifiedFactor && aal.currentLevel === "aal1") {
    // User has MFA but hasn't completed the challenge yet — carry next through
    redirect(`/login/verify-mfa?next=${encodeURIComponent(safeNext)}`);
  }

  const signupComplete = await hasCompletedSignup(authData.user.id);

  revalidatePath("/", "layout");
  redirect(signupComplete ? safeNext : ROUTES.COMPLETE_SIGNUP);
}
