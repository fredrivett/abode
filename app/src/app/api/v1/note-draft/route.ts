import { type NextRequest, NextResponse } from "next/server";
import {
  clearNoteDraft,
  getNoteDraft,
  saveNoteDraft,
} from "@/lib/items/note-draft";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/note-draft");

// Generous ceiling — a draft is autosaved frequently, so cap it to protect the
// row/request rather than trust unbounded client input.
const MAX_DRAFT_LENGTH = 500_000;

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Returns the caller's saved composer draft, if any. */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ content: await getNoteDraft(userId) });
  } catch (error) {
    log.error({ error }, "Note draft read error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/note-draft",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Upserts the caller's composer draft. Uses POST (not PUT) so the composer can
 * also flush it via `navigator.sendBeacon`, which only issues POST requests.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { message: "Invalid content field: must be a string" },
        { status: 400 },
      );
    }
    if (content.length > MAX_DRAFT_LENGTH) {
      return NextResponse.json({ message: "Draft too large" }, { status: 413 });
    }

    await saveNoteDraft(userId, content);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Note draft save error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/note-draft",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/** Clears the caller's composer draft (explicit "Clear"). */
export async function DELETE() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await clearNoteDraft(userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Note draft delete error");
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/note-draft",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
