import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger.server";
import { decodeCursor, parsePageSize } from "@/lib/pagination";
import { listTokenSavedItems } from "@/lib/personal-access-tokens";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/tokens/[id]/items");

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/tokens/:id/items - The items a personal access token saved,
 * newest first (`?cursor=` for the next page). Session-only: a token can't
 * list what tokens did.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rawCursor = request.nextUrl.searchParams.get("cursor");
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    if (rawCursor && !cursor) {
      return NextResponse.json({ message: "Invalid cursor" }, { status: 400 });
    }

    const page = await listTokenSavedItems({
      userId: user.id,
      tokenId: id,
      cursor,
      limit: parsePageSize(request.nextUrl.searchParams.get("limit")),
    });
    if (!page) {
      return NextResponse.json({ message: "Token not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    log.error({ error }, "Failed to list token items");
    captureServerException(error, undefined, {
      route: "GET /api/v1/tokens/[id]/items",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
