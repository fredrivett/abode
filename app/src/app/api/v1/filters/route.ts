import { type NextRequest, NextResponse } from "next/server";
import {
  type AvailableFilterType,
  getAvailableFilters,
} from "@/lib/items/available-filters";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/filters");

const VALID_FILTER_TYPES: AvailableFilterType[] = [
  "tag",
  "object",
  "color",
  "source",
  "location",
  "type",
  "status",
];

function isValidFilterType(value: string | null): value is AvailableFilterType {
  return (
    value !== null && VALID_FILTER_TYPES.includes(value as AvailableFilterType)
  );
}

/**
 * GET /api/v1/filters
 *
 * Returns available filter values for autocomplete.
 * - If `type` query param provided: returns values for that filter type only
 * - If no `type`: returns all filter values grouped by type
 * - All values sorted alphabetically
 * - Location values deduplicated across all location fields
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(user.id, "filters");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult, "filters"),
        },
      );
    }

    const typeParam = new URL(request.url).searchParams.get("type");
    if (typeParam !== null && !isValidFilterType(typeParam)) {
      return NextResponse.json(
        { message: "Invalid filter type" },
        { status: 400 },
      );
    }

    const response = await getAvailableFilters(user.id, typeParam ?? undefined);

    return NextResponse.json(response, {
      headers: getRateLimitHeaders(rateLimitResult, "filters"),
    });
  } catch (error) {
    log.error({ error }, "Filters fetch error");
    captureServerException(error, undefined, { route: "GET /api/v1/filters" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
