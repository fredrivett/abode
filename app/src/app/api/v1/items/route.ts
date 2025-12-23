import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import type { analyzeImageTask } from "../../../../../trigger/analyze-image";

const log = createLogger("api/v1/items");

const allowedKinds = new Set(["image", "article"]);

export async function GET(_request: NextRequest) {
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
        sourceType: true,
        sourceUrl: true,
        coverFileKey: true,
        createdAt: true,
        updatedAt: true,
        title: true,
        description: true,
        tags: true,
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
        imageDetails: {
          select: {
            objects: true,
            colors: true,
            ocrText: true,
          },
        },
        articleDetails: {
          select: {
            author: true,
            domain: true,
            publishedAt: true,
            readingTime: true,
            content: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Flatten imageDetails for backward compatibility with frontend
    const flattenedItems = items.map((item) => ({
      ...item,
      objects: item.imageDetails?.objects ?? [],
      colors: item.imageDetails?.colors ?? [],
      ocrText: item.imageDetails?.ocrText ?? null,
      imageDetails: undefined,
    }));

    return NextResponse.json(flattenedItems);
  } catch (error) {
    log.error({ error }, "Items fetch error");
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
    const { kind, fileKey, meta, sourceType, sourceUrl } = body;

    // kind is optional (null for URL-sourced items during classification)
    // but if provided, must be valid
    if (kind && !allowedKinds.has(kind)) {
      return NextResponse.json(
        { message: "Kind must be valid if provided" },
        { status: 400 },
      );
    }

    if (fileKey && !fileKey.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { message: "File key must be in the user's folder" },
        { status: 400 },
      );
    }

    // Get file size from meta for storage tracking
    const fileSize =
      meta && typeof meta === "object" && "size" in meta
        ? BigInt(meta.size as number)
        : BigInt(0);

    // Create the item and update user storage in a transaction
    const item = await db.$transaction(async (tx) => {
      const newItem = await tx.item.create({
        data: {
          kind: kind || null,
          fileKey: fileKey || null,
          meta: meta || null,
          sourceType: sourceType || null,
          sourceUrl: sourceUrl || null,
          userId: user.id,
          processingStatus: "processing",
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
        },
      });

      // Update user's storage usage
      if (fileSize > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { storageUsedBytes: { increment: fileSize } },
        });
      }

      return newItem;
    });

    // Trigger image analysis via Trigger.dev (returns immediately)
    if (kind === "image" && fileKey) {
      await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
        itemId: item.id,
        userId: user.id,
        fileKey,
      });
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    log.error({ error }, "Item creation error");
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
      select: { id: true, userId: true, fileKey: true, meta: true },
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
        log.error(
          { itemId: id, error: storageError },
          "Storage deletion error",
        );
        // Continue with DB deletion even if storage deletion fails
      }
    }

    // Get file size for storage tracking
    const meta = item.meta as { size?: number } | null;
    const fileSize =
      meta && typeof meta.size === "number" ? BigInt(meta.size) : BigInt(0);

    // Delete from database and update storage in a transaction
    await db.$transaction(async (tx) => {
      await tx.item.delete({
        where: { id },
      });

      // Decrement user's storage usage
      if (fileSize > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { storageUsedBytes: { decrement: fileSize } },
        });
      }
    });

    return NextResponse.json({ message: "Item deleted" }, { status: 200 });
  } catch (error) {
    log.error({ error }, "Item deletion error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
