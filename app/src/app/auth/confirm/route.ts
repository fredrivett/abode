import { type NextRequest, NextResponse } from "next/server";
import { completeSignup } from "@/lib/auth/complete-signup";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("auth/confirm");

const VALID_OTP_TYPES = [
  "email",
  "signup",
  "recovery",
  "email_change",
] as const;
type OtpType = (typeof VALID_OTP_TYPES)[number];

function isValidOtpType(value: string | null): value is OtpType {
  return value !== null && VALID_OTP_TYPES.includes(value as OtpType);
}

/**
 * Auth callback route handler for Supabase email verification links.
 *
 * When a user clicks the verification link in their email, Supabase redirects
 * them here with token_hash and type query parameters. This route:
 * 1. Verifies the token with Supabase
 * 2. Extracts user metadata (pending_username, invite_token)
 * 3. Completes user setup (username, invite acceptance)
 * 4. Redirects to dashboard or complete-signup page
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || !isValidOtpType(type)) {
    log.warn(
      { tokenHash: !!tokenHash, type },
      "Invalid token_hash or type in auth callback",
    );
    return NextResponse.redirect(
      new URL("/auth/error?reason=missing_params", origin),
    );
  }

  const supabase = await createClient();

  // Verify the OTP using token_hash
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    log.error(
      { error: error.message },
      "Failed to verify OTP in auth callback",
    );
    return NextResponse.redirect(
      new URL("/auth/error?reason=verification_failed", origin),
    );
  }

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    log.error("No user found after OTP verification");
    return NextResponse.redirect(new URL("/auth/error?reason=no_user", origin));
  }

  // Extract user metadata
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const pendingUsername = metadata?.pending_username as string | undefined;
  const inviteToken = metadata?.invite_token as string | undefined;
  const oauthPicture =
    (metadata?.picture as string) || (metadata?.avatar_url as string) || null;

  // Check if user already has username set (e.g., clicking link multiple times)
  const existingUser = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true },
  });

  if (existingUser?.username) {
    // User already completed signup, just redirect to dashboard
    log.info(
      { userId: user.id },
      "User already has username, redirecting to dashboard",
    );
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  // Check if we have the required metadata to complete signup
  if (pendingUsername) {
    const result = await completeSignup({
      userId: user.id,
      email: user.email,
      username: pendingUsername,
      inviteToken,
      oauthPicture,
    });

    if (!result.success) {
      log.error(
        { error: result.error, code: result.code },
        "Failed to complete signup",
      );
      return NextResponse.redirect(
        new URL(`/auth/error?reason=${result.code}`, origin),
      );
    }

    // Track signup completion with PostHog
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "signup_completed",
      properties: {
        username: pendingUsername,
        email: user.email,
        via_invite: !!inviteToken,
      },
    });
    posthog?.identify({
      distinctId: user.id,
      properties: {
        email: user.email,
        username: pendingUsername,
      },
    });

    log.info(
      { userId: user.id, username: pendingUsername },
      "Signup completed via email link",
    );
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  // No pending_username in metadata - redirect to complete-signup page
  // This handles edge cases where metadata is missing
  log.warn({ userId: user.id }, "User verified but missing username metadata");
  return NextResponse.redirect(new URL("/complete-signup", origin));
}
