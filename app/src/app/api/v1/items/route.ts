import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

const allowedKinds = new Set(["image"]);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const items = await db.item.findMany({
      where: { userId: user.id },
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Items fetch error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

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
    const { kind, fileKey, meta, source } = body;

    if (!kind || !allowedKinds.has(kind)) {
      return NextResponse.json(
        { message: "Kind is required and must be valid" },
        { status: 400 },
      );
    }

    if (fileKey && !fileKey.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { message: "File key must be in the user's folder" },
        { status: 400 },
      );
    }

    const item = await db.item.create({
      data: {
        kind,
        fileKey: fileKey || null,
        meta: meta || null,
        source: source || null,
        userId: user.id,
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

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Item creation error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Item ID is required" },
        { status: 400 },
      );
    }

    // Find the item to ensure it exists and belongs to the user
    const item = await db.item.findUnique({
      where: { id },
      select: { id: true, userId: true, fileKey: true },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    if (item.userId !== user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Delete from storage if there's a file
    if (item.fileKey) {
      const { error: storageError } = await supabase.storage
        .from("items")
        .remove([item.fileKey]);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
        // Continue with DB deletion even if storage deletion fails
      }
    }

    // Delete from database
    await db.item.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Item deleted" }, { status: 200 });
  } catch (error) {
    console.error("Item deletion error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
