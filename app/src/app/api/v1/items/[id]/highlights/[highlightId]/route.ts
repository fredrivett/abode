import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/[id]/highlights/[highlightId]");

type RouteParams = { params: Promise<{ id: string; highlightId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: itemId, highlightId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Verify highlight exists and belongs to user
    const existingHighlight = await db.articleHighlight.findUnique({
      where: {
        id: highlightId,
        itemId,
        userId: user.id,
      },
    });

    if (!existingHighlight) {
      return NextResponse.json(
        { message: "Highlight not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { note } = body;

    const updatedHighlight = await db.articleHighlight.update({
      where: { id: highlightId },
      data: {
        ...(note !== undefined && { note }),
      },
      select: {
        id: true,
        itemId: true,
        startOffset: true,
        endOffset: true,
        text: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedHighlight);
  } catch (error) {
    log.error({ error }, "Highlight update error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: itemId, highlightId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Verify highlight exists and belongs to user
    const existingHighlight = await db.articleHighlight.findUnique({
      where: {
        id: highlightId,
        itemId,
        userId: user.id,
      },
    });

    if (!existingHighlight) {
      return NextResponse.json(
        { message: "Highlight not found" },
        { status: 404 },
      );
    }

    await db.articleHighlight.delete({
      where: { id: highlightId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Highlight deletion error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
