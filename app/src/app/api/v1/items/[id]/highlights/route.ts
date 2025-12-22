import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/[id]/highlights");

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: itemId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Verify item exists and belongs to user
    const item = await db.item.findUnique({
      where: {
        id: itemId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    const highlights = await db.articleHighlight.findMany({
      where: {
        itemId,
        userId: user.id,
      },
      orderBy: { startOffset: "asc" },
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

    return NextResponse.json(highlights);
  } catch (error) {
    log.error({ error }, "Highlights fetch error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: itemId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Verify item exists, belongs to user, and is an article
    const item = await db.item.findUnique({
      where: {
        id: itemId,
        userId: user.id,
      },
      select: {
        id: true,
        kind: true,
        articleDetails: {
          select: { content: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    if (item.kind !== "article") {
      return NextResponse.json(
        { message: "Item is not an article" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { startOffset, endOffset, text, note } = body;

    // Validate required fields
    if (
      typeof startOffset !== "number" ||
      typeof endOffset !== "number" ||
      typeof text !== "string"
    ) {
      return NextResponse.json(
        { message: "startOffset, endOffset, and text are required" },
        { status: 400 },
      );
    }

    if (startOffset < 0 || endOffset <= startOffset) {
      return NextResponse.json(
        { message: "Invalid offset range" },
        { status: 400 },
      );
    }

    // Validate offsets are within content bounds
    const contentLength = item.articleDetails?.content?.length ?? 0;
    if (endOffset > contentLength) {
      return NextResponse.json(
        { message: "Offset exceeds content length" },
        { status: 400 },
      );
    }

    const highlight = await db.articleHighlight.create({
      data: {
        itemId,
        userId: user.id,
        startOffset,
        endOffset,
        text,
        note: note ?? null,
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

    return NextResponse.json(highlight, { status: 201 });
  } catch (error) {
    log.error({ error }, "Highlight creation error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
