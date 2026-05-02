"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("auth/reset-password");

export type ResetPasswordResult = {
  error?: string;
};

export async function updatePassword(
  _prevState: ResetPasswordResult,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    log.error(
      { userId: user.id, error: error.message },
      "Failed to update password",
    );
    captureServerException(error, user.id, { action: "update_password" });
    return { error: error.message };
  }

  log.info({ userId: user.id }, "Password updated via recovery flow");

  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: user.id,
    event: "password_reset",
  });

  revalidatePath("/", "layout");
  redirect(ROUTES.DASHBOARD);
}
