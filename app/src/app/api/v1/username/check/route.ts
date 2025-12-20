import { type NextRequest, NextResponse } from "next/server";
import { read } from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { validateUsername } from "@/lib/username";
import { findNextAvailableUsername } from "@/lib/username/generate-from-email";

const log = createLogger("api/v1/username/check");

/**
 * GET /api/v1/username/check?username=foo
 *
 * Check if a username is available.
 * Rate limited by IP since this can be called pre-auth.
 *
 * Response:
 * - { available: true }
 * - { available: false, error: "...", suggestion?: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { message: "Username is required" },
        { status: 400 },
      );
    }

    // Rate limiting by IP (since this can be called pre-auth)
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(ip, "usernameCheck");

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit, "usernameCheck"),
        },
      );
    }

    // Validate format, reserved words, offensive content
    const validation = validateUsername(username);
    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        error: validation.error,
      });
    }

    // Check database for existing username (case-insensitive)
    const existing = await read.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existing) {
      // Find a suggestion
      const suggestion = await findNextAvailableUsername(username);

      return NextResponse.json({
        available: false,
        error: "Username is already taken",
        suggestion,
      });
    }

    return NextResponse.json({
      available: true,
    });
  } catch (error) {
    log.error({ error }, "Username check error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
