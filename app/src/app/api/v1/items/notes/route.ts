import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticate-request";
import { preflight, withCors } from "@/lib/http/cors";
import { captureAttribution } from "@/lib/items/capture-source";
import { createNote } from "@/lib/items/create-note";
import { clearNoteDraft } from "@/lib/items/note-draft";
import { transformItem } from "@/lib/items/query";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("api/v1/items/notes");

// Cross-origin preflight for the browser extension's "save selection as note".
export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

/**
 * Creates a user-authored note item.
 *
 * Notes are composed in-app (markdown) or captured from a page selection via
 * the extension, so there's no URL fetch or background classification — the
 * item is created synchronously and marked completed.
 */
export async function POST(request: NextRequest) {
  return withCors(request, await handlePost(request));
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { tokenScope: "write" });
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const { content, title, source } = body;

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { message: "Invalid content field: must be a string" },
        { status: 400 },
      );
    }

    if (title !== undefined && title !== null && typeof title !== "string") {
      return NextResponse.json(
        { message: "Invalid title field: must be a string or null" },
        { status: 400 },
      );
    }

    // Extension "save selection as note" passes source: "extension"; the in-app
    // composer omits it and defaults to "web". A token save is always "api".
    const { captureSource, personalAccessTokenId } = captureAttribution(
      auth,
      source,
    );
    const item = await createNote(user.id, {
      content,
      title,
      source: captureSource,
      personalAccessTokenId,
    });

    // The in-app composer's save (a cookie session) clears its in-progress draft
    // in the same request, so the client needs no extra call. Extension and token
    // saves leave it alone — they didn't come from the composer.
    if (auth.method === "cookie") await clearNoteDraft(user.id);

    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "note_created",
      properties: {
        item_id: item.id,
        source: captureSource,
        token_id: personalAccessTokenId,
      },
    });

    return NextResponse.json(transformItem(item), { status: 201 });
  } catch (error) {
    log.error({ error }, "Note creation error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/items/notes",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
