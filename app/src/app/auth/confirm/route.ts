import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { completeSignup } from "@/lib/auth/complete-signup";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getPostHogClient } from "@/lib/posthog-server";

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
 * Copy cookies from source response to target response
 */
function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
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

  // Create Supabase client with cookie handling for Route Handler
  // This follows the same pattern as middleware
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Verify the OTP using token_hash
  log.info({ type }, "Verifying OTP with token_hash");
  const {
    data: { user },
    error,
  } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    log.error(
      { error: error.message },
      "Failed to verify OTP in auth callback",
    );
    const redirect = NextResponse.redirect(
      new URL("/auth/error?reason=verification_failed", origin),
    );
    return copyCookies(response, redirect);
  }

  log.info(
    {
      userId: user?.id,
      email: user?.email,
      hasUser: !!user,
      metadataKeys: user?.user_metadata ? Object.keys(user.user_metadata) : [],
      metadata: user?.user_metadata,
    },
    "OTP verified - user data received",
  );

  // Track password recovery completion
  if (type === "recovery" && user) {
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "password_recovery_completed",
    });
  }

  // Handle email change completion
  if (type === "email_change" && user?.email) {
    // Sync database email with the new Supabase auth email
    // Auth is the source of truth - if this fails, daily reconcile task will fix it
    let dbSyncSuccess = false;
    try {
      await db.user.update({
        where: { id: user.id },
        data: { email: user.email.toLowerCase() },
      });
      dbSyncSuccess = true;
    } catch (dbError) {
      log.error(
        { error: dbError, userId: user.id, newEmail: user.email },
        "Failed to sync email to database - daily reconcile task will fix",
      );
    }

    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "email_change_completed",
      properties: {
        new_email_domain: user.email.split("@")[1],
        db_sync_success: dbSyncSuccess,
      },
    });

    log.info({ userId: user.id }, "Email change completed");
    const redirect = NextResponse.redirect(
      new URL("/settings/account?email_changed=true", origin),
    );
    return copyCookies(response, redirect);
  }

  if (!user || !user.email) {
    log.error("No user found after OTP verification");
    const redirect = NextResponse.redirect(new URL("/auth/error?reason=no_user", origin));
    return copyCookies(response, redirect);
  }

  // Extract user metadata
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const pendingUsername = metadata?.pending_username as string | undefined;
  const inviteToken = metadata?.invite_token as string | undefined;
  const oauthPicture =
    (metadata?.picture as string) || (metadata?.avatar_url as string) || null;

  log.info(
    {
      userId: user.id,
      pendingUsername,
      inviteToken,
      hasOauthPicture: !!oauthPicture,
    },
    "Extracted metadata from user",
  );

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
    const redirect = NextResponse.redirect(new URL("/dashboard", origin));
    return copyCookies(response, redirect);
  }

  // Check if we have the required metadata to complete signup
  if (pendingUsername) {
    log.info(
      {
        userId: user.id,
        username: pendingUsername,
        hasInviteToken: !!inviteToken,
      },
      "Attempting to complete signup with pending username",
    );

    const result = await completeSignup({
      userId: user.id,
      email: user.email,
      username: pendingUsername,
      inviteToken,
      oauthPicture,
    });

    if (!result.success) {
      log.error(
        { error: result.error, code: result.code, userId: user.id },
        "Failed to complete signup",
      );
      const redirect = NextResponse.redirect(
        new URL(`/auth/error?reason=${result.code}`, origin),
      );
      return copyCookies(response, redirect);
    }

    log.info(
      { userId: user.id, username: pendingUsername },
      "Successfully completed signup",
    );

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
    const redirect = NextResponse.redirect(new URL("/dashboard", origin));
    return copyCookies(response, redirect);
  }

  // No pending_username in metadata - redirect to complete-signup page
  // This handles edge cases where metadata is missing
  log.warn({ userId: user.id }, "User verified but missing username metadata");
  const redirect = NextResponse.redirect(new URL("/complete-signup", origin));
  return copyCookies(response, redirect);
}
