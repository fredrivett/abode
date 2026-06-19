import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { itemSelect, transformItem } from "@/lib/items/query";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/notes");

/**
 * Creates a user-authored note item.
 *
 * Notes are composed in-app (markdown), so there's no URL fetch or background
 * classification — the item is created synchronously and marked completed.
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

    const body = await request.json().catch(() => ({}));
    const { content, title } = body;

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

    const item = await db.item.create({
      data: {
        kind: "note",
        sourceType: "compose",
        processingStatus: "completed",
        userId: user.id,
        title: title?.trim() || null,
        noteDetails: {
          create: { content: typeof content === "string" ? content : "" },
        },
      },
      select: itemSelect,
    });

    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "note_created",
      properties: { item_id: item.id },
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
