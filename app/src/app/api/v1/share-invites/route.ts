import { type NextRequest, NextResponse } from "next/server";
import { requestShareInvite } from "@/lib/invites/share-invite";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { shareInviteSchema } from "./schema";

const log = createLogger("api/share-invites");

/**
 * POST /api/v1/share-invites
 * Public: a reader of a shared item asks to join abode with the sharer's
 * invite. Rate limited per IP, since each request can spend one of the
 * sharer's invites.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request.headers);
    const rateLimit = checkRateLimit(clientIp, "shareInvite");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429, headers: getRateLimitHeaders(rateLimit, "shareInvite") },
      );
    }

    // Malformed JSON is a bad request, not a server error
    const body = await request.json().catch(() => null);
    const parsed = shareInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "An email and item are required" },
        { status: 400 },
      );
    }

    const outcome = await requestShareInvite(parsed.data);
    const headers = getRateLimitHeaders(rateLimit, "shareInvite");

    if (outcome.status === "unavailable") {
      return NextResponse.json(
        { message: "Not found" },
        { status: 404, headers },
      );
    }
    if (outcome.status === "invalid_email") {
      return NextResponse.json(
        { message: outcome.error },
        { status: 400, headers },
      );
    }
    return NextResponse.json(outcome, { headers });
  } catch (error) {
    log.error({ error }, "Share invite request failed");
    captureServerException(error, undefined, {
      route: "POST /api/v1/share-invites",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
