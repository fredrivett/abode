import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { analyzeImage } from "@/lib/vision";
import { generateImageEmbedding, generateTextEmbedding } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("api/v1/items");

const allowedKinds = new Set(["image"]);

/**
 * Analyze an image asynchronously and update the item with results
 */
async function analyzeImageAsync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  userId: string,
  fileKey: string,
) {
  try {
    // Download the image from storage
    const { data, error } = await supabase.storage
      .from("items")
      .download(fileKey);

    if (error || !data) {
      throw new Error(`Failed to download image: ${error?.message}`);
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Analyze the image with Vision API
    const analysis = await analyzeImage(buffer);

    // Update the item with analysis results
    await db.item.update({
      where: { id: itemId },
      data: {
        title: analysis.title,
        description: analysis.description,
        tags: analysis.tags,
        objects: analysis.objects,
        ocrText: analysis.ocrText,
        colors: analysis.colors,
        visionData: analysis.visionData,
        processingStatus: "completed",
      },
    });

    log.info(
      {
        itemId,
        title: analysis.title,
        description: analysis.description,
        tags: analysis.tags,
        objects: analysis.objects,
        ocrText: analysis.ocrText?.slice(0, 100),
        colorCount: analysis.colors.length,
        topColors: analysis.colors.slice(0, 3),
      },
      "Image analysis completed",
    );

    // Generate embeddings asynchronously (don't block on this)
    generateEmbeddingsAsync(supabase, itemId, userId, fileKey, analysis).catch(
      (error) => {
        log.error({ itemId, error }, "Embedding generation failed");
      },
    );
  } catch (error) {
    log.error({ itemId, error }, "Image analysis failed");

    // Mark as failed
    await db.item.update({
      where: { id: itemId },
      data: { processingStatus: "failed" },
    });
  }
}

/**
 * Generate and store embeddings for an item
 */
async function generateEmbeddingsAsync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  userId: string,
  fileKey: string,
  analysis: { tags: string[]; objects: string[]; ocrText: string | null },
) {
  try {
    log.info({ itemId }, "Starting embedding generation");

    // Get signed URL for the image (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from("items")
      .createSignedUrl(fileKey, 3600);

    if (urlError || !urlData) {
      throw new Error(`Failed to create signed URL: ${urlError?.message}`);
    }

    // Generate visual embedding (CLIP)
    const visualEmbedding = await generateImageEmbedding(urlData.signedUrl);

    // Store visual embedding
    await db.itemVector.create({
      data: {
        itemId,
        userId,
        kind: "visual",
        model: "clip-vit-base-patch32",
        embedding: `[${visualEmbedding.join(",")}]`, // Postgres vector format
      },
    });

    log.info({ itemId }, "Visual embedding stored");

    // Generate text embedding if we have text content
    const textContent = [
      ...(analysis.tags || []),
      ...(analysis.objects || []),
      analysis.ocrText,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (textContent) {
      const textEmbedding = await generateTextEmbedding(textContent);

      // Store text embedding
      await db.itemVector.create({
        data: {
          itemId,
          userId,
          kind: "text",
          model: "text-embedding-3-small",
          embedding: `[${textEmbedding.join(",")}]`, // Postgres vector format
        },
      });

      log.info({ itemId }, "Text embedding stored");
    }

    log.info({ itemId }, "All embeddings generated and stored");
  } catch (error) {
    log.error({ itemId, error }, "Failed to generate embeddings");
    // Don't throw - we don't want to fail the whole process if embeddings fail
  }
}

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

    // Create the item initially with "processing" status
    const item = await db.item.create({
      data: {
        kind,
        fileKey: fileKey || null,
        meta: meta || null,
        source: source || null,
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
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Trigger image analysis asynchronously (don't wait for it)
    if (kind === "image" && fileKey) {
      analyzeImageAsync(supabase, item.id, user.id, fileKey).catch((error) => {
        log.error({ error }, "Image analysis error");
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
        log.error({ itemId: id, error: storageError }, "Storage deletion error");
        // Continue with DB deletion even if storage deletion fails
      }
    }

    // Delete from database
    await db.item.delete({
      where: { id },
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
