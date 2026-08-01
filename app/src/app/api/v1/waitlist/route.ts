import { type NextRequest, NextResponse } from "next/server";
import { captureServerException } from "@/lib/posthog-server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { joinWaitlist } from "@/lib/waitlist";

/**
 * POST /api/v1/waitlist
 * Add email to waitlist
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP address
    const clientIp = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(clientIp, "waitlist");

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult, "waitlist"),
        },
      );
    }

    const body = await request.json();
    const { email, referralSource } = body as {
      email?: string;
      referralSource?: string;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const result = await joinWaitlist(email, referralSource);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        position: result.position,
      },
      {
        headers: getRateLimitHeaders(rateLimitResult, "waitlist"),
      },
    );
  } catch (error) {
    captureServerException(error, undefined, {
      route: "POST /api/v1/waitlist",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
