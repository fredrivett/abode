import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger } from "@/lib/logger.server";
import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
} from "@/lib/personal-access-tokens";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/tokens");

const createTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  // Constrained to the lifetimes the UI offers; null / omitted = no expiry
  expiresInDays: z
    .union([z.literal(30), z.literal(90)])
    .nullable()
    .optional(),
});

/**
 * GET /api/v1/tokens - List the current user's active personal access tokens
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const tokens = await listPersonalAccessTokens(user.id);
    return NextResponse.json({ tokens });
  } catch (error) {
    log.error({ error }, "Failed to list tokens");
    captureServerException(error, undefined, { route: "GET /api/v1/tokens" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/tokens - Mint a new personal access token. The raw token is
 * returned once in the response and never again.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(user.id, "tokenCreate");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit, "tokenCreate"),
        },
      );
    }

    const parsed = createTokenSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { token, summary } = await createPersonalAccessToken(user.id, {
      name: parsed.data.name,
      expiresInDays: parsed.data.expiresInDays ?? null,
    });

    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "token_created",
      properties: {
        token_id: summary.id,
        has_expiry: summary.expiresAt !== null,
      },
    });

    // token is included once here; only the summary is retrievable afterwards
    return NextResponse.json({ token, tokenSummary: summary }, { status: 201 });
  } catch (error) {
    log.error({ error }, "Failed to create token");
    captureServerException(error, undefined, { route: "POST /api/v1/tokens" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
