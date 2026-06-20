import { type NextRequest, NextResponse } from "next/server";
import {
  createItemFromUrl,
  InvalidUrlError,
  isItemSource,
} from "@/lib/items/from-url";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

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
