import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/[id]");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const item = await db.item.findUnique({
      where: {
        id,
        userId: user.id, // Ensure user can only access their own items
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        fileKey: true,
        meta: true,
        sourceType: true,
        sourceUrl: true,
        coverFileKey: true,
        createdAt: true,
        updatedAt: true,
        title: true,
        description: true,
        tags: true,
        objects: true,
        colors: true,
        ocrText: true,
        locations: {
          select: {
            id: true,
            source: true,
            latitude: true,
            longitude: true,
            neighborhood: true,
            city: true,
            region: true,
            country: true,
            countryCode: true,
            formatted: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    log.error({ error }, "Item fetch error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      processingStatus,
      fileKey,
      meta,
      sourceType,
      sourceUrl,
      kind,
      coverFileKey,
    } = body;

    // Check if item exists and belongs to user
    const existingItem = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    const updatedItem = await db.item.update({
      where: { id },
      data: {
        ...(processingStatus !== undefined && { processingStatus }),
        ...(fileKey !== undefined && { fileKey }),
        ...(meta !== undefined && { meta }),
        ...(sourceType !== undefined && { sourceType }),
        ...(sourceUrl !== undefined && { sourceUrl }),
        ...(kind !== undefined && { kind }),
        ...(coverFileKey !== undefined && { coverFileKey }),
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        fileKey: true,
        meta: true,
        sourceType: true,
        sourceUrl: true,
        coverFileKey: true,
        createdAt: true,
        updatedAt: true,
        title: true,
        description: true,
        tags: true,
        objects: true,
        colors: true,
        ocrText: true,
        locations: {
          select: {
            id: true,
            source: true,
            latitude: true,
            longitude: true,
            neighborhood: true,
            city: true,
            region: true,
            country: true,
            countryCode: true,
            formatted: true,
          },
        },
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    log.error({ error }, "Item update error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if item exists and belongs to user
    const existingItem = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    await db.item.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Item deletion error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
