import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import type { classifyUrlTask } from "../../../../../../trigger/classify-url";

const log = createLogger("api/v1/items/from-url");

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

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { message: "URL is required" },
        { status: 400 },
      );
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { message: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Create the item with null kind (will be classified by background task)
    const item = await db.item.create({
      data: {
        kind: null,
        sourceType: "url",
        sourceUrl: parsedUrl.href,
        userId: user.id,
        processingStatus: "processing",
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        sourceType: true,
        sourceUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Trigger URL classification task
    await tasks.trigger<typeof classifyUrlTask>("classify-url", {
      itemId: item.id,
      userId: user.id,
      url: parsedUrl.href,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    log.error({ error }, "Item creation from URL error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
