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
import { guardDailyLimit } from "@/lib/usage-limits";

const log = createLogger("api/v1/items/from-url");

// Upper bound on extension-captured rendered HTML. Real pages run large; this
// caps the request body so a pathological page can't balloon the payload. Over
// the cap we drop the HTML and fall back to a server-side fetch rather than
// rejecting the save.
const MAX_CAPTURED_HTML_CHARS = 5_000_000;

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

    // Durable per-user daily cap (each URL import = several paid AI calls).
    const guard = await guardDailyLimit(user.id, "ingestion");
    if (!guard.ok) {
      return NextResponse.json(
        { message: "Daily limit reached" },
        {
          status: 429,
          headers: { "Retry-After": String(guard.check.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const { url, source, html } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ message: "URL is required" }, { status: 400 });
    }

    // Optional extension-captured rendered DOM. Only trust a non-empty string,
    // within the size cap, that actually looks like a serialized document — a
    // real capture is `document.documentElement.outerHTML`, which always starts
    // with an <html> tag. Anything oversized or not a document falls back to the
    // server-side fetch (never persist a blank page) rather than failing the save.
    let capturedHtml: string | undefined;
    if (typeof html === "string" && html.length > 0) {
      if (html.length > MAX_CAPTURED_HTML_CHARS) {
        log.warn(
          { htmlLength: html.length },
          "Captured HTML over size cap; falling back to server fetch",
        );
      } else if (!/<html[\s/>]/i.test(html)) {
        log.warn(
          "Captured HTML is not a document; falling back to server fetch",
        );
      } else {
        capturedHtml = html;
      }
    }

    try {
      const item = await createItemFromUrl({
        userId: user.id,
        url,
        source: isItemSource(source) ? source : "web",
        html: capturedHtml,
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
