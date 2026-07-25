import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticate-request";
import { preflight, withCors } from "@/lib/http/cors";
import {
  createItemFromUrl,
  InvalidUrlError,
  isItemSource,
} from "@/lib/items/from-url";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/items/from-url");

// Cross-origin preflight for the browser extension (and future first-party
// clients). Bearer-authed, so no credentials are involved — see lib/http/cors.
export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  return withCors(request, await handlePost(request));
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const user = auth.user;

    const body = await request.json();
    const { url, source } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ message: "URL is required" }, { status: 400 });
    }

    try {
      const item = await createItemFromUrl({
        userId: user.id,
        url,
        source: isItemSource(source) ? source : "web",
      });
      return NextResponse.json(item, { status: 201 });
    } catch (error) {
      if (error instanceof InvalidUrlError) {
        return NextResponse.json(
          { message: "Invalid URL format" },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    log.error({ error }, "Item creation from URL error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/items/from-url",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
