import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Item fetch error:", error);
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
    const { processingStatus, fileKey, meta, source } = body;

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
        ...(source !== undefined && { source }),
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        fileKey: true,
        meta: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Item update error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    console.error("Item deletion error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
