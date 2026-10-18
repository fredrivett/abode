import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/verify-password";
import { setSensitiveUnlockCookie } from "@/lib/items/sensitive-unlock";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/sensitive-unlock");

const bodySchema = z.object({ password: z.string().min(1).max(1024) });

/**
 * POST /api/v1/sensitive-unlock
 * Re-enter your password to open sensitive items for the next couple of
 * minutes (see `@/lib/items/sensitive-unlock`). Cookie session only.
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const rateLimit = checkRateLimit(user.id, "sensitiveUnlock");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many attempts. Please wait a minute and try again." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit, "sensitiveUnlock"),
        },
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Password is required" },
        { status: 400 },
      );
    }
    if (!user.email) {
      return NextResponse.json(
        { message: "Your account has no password to check" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword({
      email: user.email,
      password: parsed.data.password,
    });
    getPostHogClient()?.capture({
      distinctId: user.id,
      event: valid ? "sensitive_item_unlocked" : "sensitive_unlock_failed",
    });
    if (!valid) {
      // 403, not 401: the session is fine, only the password was wrong
      return NextResponse.json(
        { message: "Incorrect password", code: "incorrect_password" },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ unlocked: true });
    setSensitiveUnlockCookie({ response, userId: user.id });
    return response;
  } catch (error) {
    log.error({ error, userId }, "Sensitive unlock error");
    captureServerException(error, userId, {
      route: "POST /api/v1/sensitive-unlock",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
