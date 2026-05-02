"use server";

import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/url";

const log = createLogger("auth/forgot-password");

export type ForgotPasswordResult = {
  error?: string;
  success?: boolean;
  email?: string;
};

export async function requestPasswordReset(
  _prevState: ForgotPasswordResult,
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  const supabase = await createClient();
  const redirectTo = `${getAppBaseUrl()}/auth/confirm?type=recovery&next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    log.warn(
      { email, error: error.message },
      "resetPasswordForEmail returned error - returning generic success to avoid enumeration",
    );
    captureServerException(error, undefined, {
      action: "request_password_reset",
    });
  } else {
    log.info({ email }, "Password reset email requested");
  }

  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: email,
    event: "password_recovery_requested",
    properties: { email },
  });

  return { success: true, email };
}
