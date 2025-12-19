import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import type { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import {
  generateImageEmbedding,
  generateTextEmbedding,
} from "../src/lib/embeddings";
import { extractExifData } from "../src/lib/exif";
import { reverseGeocode } from "../src/lib/reverse-geocode";
import { analyzeImage, generateAITitle } from "../src/lib/vision";
import type { syncItemToRoomsTask } from "./sync-item-to-rooms";

type AnalyzeImagePayload = {
  itemId: string;
  userId: string;
  fileKey: string;
};

type EmbeddingInsert = {
  itemId: string;
  userId: string;
  model: string;
  embedding: number[];
};

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for analyze-image",
    );
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for analyze-image");
  }

  return { url, key };
}

function formatStorageError(error: unknown) {
  if (!error) return "Unknown storage error";
  if (error instanceof Error) {
    if (error.message) return error.message;

    const props = Object.fromEntries(
      Object.getOwnPropertyNames(error).map((key) => [
        key,
        (error as unknown as Record<string, unknown>)[key],
      ]),
    );

    return inspect(props, { depth: 3 });
  }
  if (typeof error === "object") {
    const payload = error as Record<string, unknown>;

    return (
      (typeof payload.message === "string" && payload.message) ||
      (typeof payload.error === "string" && payload.error) ||
      (typeof payload.status === "number" && `status ${payload.status}`) ||
      (typeof payload.statusCode === "string" && payload.statusCode) ||
      inspect(payload, { depth: 3 })
    );
  }

  return String(error);
}

// pgvector columns aren't in the Prisma schema so we write visual vectors via raw SQL
async function insertVisualVector({
  itemId,
  userId,
  model,
  embedding,
}: EmbeddingInsert) {
  const id = randomUUID();
  const vectorLiteral = toVectorLiteral(embedding);

  await db.$executeRaw`
    INSERT INTO "item_visual_vectors" ("id", "item_id", "user_id", "model", "embedding")
    VALUES (${id}::uuid, ${itemId}::uuid, ${userId}::uuid, ${model}, ${vectorLiteral}::vector)
  `;

  return id;
}

// pgvector columns aren't in the Prisma schema so we write text vectors via raw SQL
async function insertTextVector({
  itemId,
  userId,
  model,
  embedding,
}: EmbeddingInsert) {
  const id = randomUUID();
  const vectorLiteral = toVectorLiteral(embedding);

  await db.$executeRaw`
    INSERT INTO "item_text_vectors" ("id", "item_id", "user_id", "model", "embedding")
    VALUES (${id}::uuid, ${itemId}::uuid, ${userId}::uuid, ${model}, ${vectorLiteral}::vector)
  `;

  return id;
}

export const analyzeImageTask = task({
  id: "analyze-image",
  maxDuration: 600, // 10 minutes should be plenty for Vision + embeddings
  run: async (payload: AnalyzeImagePayload) => {
    const { itemId, userId, fileKey } = payload;

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();

    logger.log("Starting image analysis", {
      itemId,
      userId,
      fileKey,
      supabaseHost: new URL(supabaseUrl).host,
    });

    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Step 1: Download the image from Supabase Storage
      logger.log("Downloading image from storage", { itemId, fileKey });

      const { data, error } = await supabase.storage
        .from("items")
        .download(fileKey);

      if (error || !data) {
        throw new Error(
          `Failed to download image: ${formatStorageError(error)}`,
        );
      }

      // Convert blob to buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.log("Image downloaded", {
        itemId,
        sizeBytes: buffer.length,
      });

      // Step 1.5: Extract EXIF data (GPS and capture date)
      const exifData = await extractExifData(buffer);
      const { gps, captureDate } = exifData;
      let place: Awaited<ReturnType<typeof reverseGeocode>> = null;

      if (captureDate) {
        logger.log("EXIF capture date found", { itemId, captureDate });
      } else {
        logger.log("No EXIF capture date in image", { itemId });
      }

      if (gps) {
        logger.log("EXIF GPS found", { itemId });
        try {
          place = await reverseGeocode(gps);
          if (place) {
            logger.log("Place found from GPS", {
              itemId,
              city: place.city,
              country: place.country,
            });
          } else {
            logger.log("Reverse geocoding returned no place", { itemId });
          }
        } catch (error) {
          logger.log("Reverse geocoding failed", { itemId, error });
        }
      } else {
        logger.log("No EXIF GPS data in image", { itemId });
      }

      if (gps || place) {
        const raw: Record<string, Prisma.InputJsonValue> = {};
        if (gps) raw.gps = gps as unknown as Prisma.InputJsonValue;
        if (place?.raw) {
          raw.mapbox = place.raw as unknown as Prisma.InputJsonValue;
        }

        await db.itemLocation.upsert({
          where: { itemId_source: { itemId, source: "exif" } },
          create: {
            itemId,
            userId,
            source: "exif",
            latitude: gps?.latitude ?? null,
            longitude: gps?.longitude ?? null,
            neighborhood: place?.neighborhood ?? null,
            city: place?.city ?? null,
            region: place?.region ?? null,
            country: place?.country ?? null,
            countryCode: place?.countryCode ?? null,
            formatted: place?.formatted ?? null,
            raw: raw as unknown as Prisma.InputJsonValue,
          },
          update: {
            latitude: gps?.latitude ?? null,
            longitude: gps?.longitude ?? null,
            neighborhood: place?.neighborhood ?? null,
            city: place?.city ?? null,
            region: place?.region ?? null,
            country: place?.country ?? null,
            countryCode: place?.countryCode ?? null,
            formatted: place?.formatted ?? null,
            raw: raw as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await db.itemLocation.deleteMany({
          where: { itemId, userId, source: "exif" },
        });
      }

      // Step 2: Analyze with Google Cloud Vision API
      logger.log("Analyzing image with Vision API", { itemId });

      const analysis = await analyzeImage(buffer);

      logger.log("Vision API analysis complete", {
        itemId,
        title: analysis.title,
        tagCount: analysis.tags.length,
        objectCount: analysis.objects.length,
        hasOcr: !!analysis.ocrText,
        colorCount: analysis.colors.length,
      });

      // Step 2.5: Fetch item metadata for original filename
      const item = await db.item.findUnique({
        where: { id: itemId },
        select: { meta: true },
      });

      const meta = item?.meta as { originalName?: string } | null;
      const originalFilename = meta?.originalName;

      logger.log("Fetched item metadata", { itemId, originalFilename });

      // Step 2.6: Generate AI-suggested title
      let finalTitle = analysis.title;
      if (
        originalFilename ||
        analysis.tags.length > 0 ||
        analysis.objects.length > 0 ||
        analysis.ocrText
      ) {
        logger.log("Generating AI title", { itemId, originalFilename });

        const aiTitle = await generateAITitle({
          originalFilename,
          labels: analysis.tags,
          objects: analysis.objects,
          ocrText: analysis.ocrText,
        });

        if (aiTitle) {
          finalTitle = aiTitle;
          logger.log("Using AI-generated title", { itemId, aiTitle });
        } else {
          logger.log(
            "AI title generation returned null, using Vision-derived title",
            {
              itemId,
              fallbackTitle: analysis.title,
            },
          );
        }
      }

      // Step 3: Update item with analysis results
      logger.log("Updating item with analysis results", { itemId });

      // Update Item and ImageDetails in a transaction for consistency
      await db.$transaction([
        // Update shared fields on Item
        db.item.update({
          where: {
            id: itemId,
            userId: userId, // Multi-tenant isolation
          },
          data: {
            title: finalTitle,
            description: analysis.description,
            tags: analysis.tags,
            processingStatus: "completed",
          },
        }),
        // Create/update image-specific details
        db.itemImageDetails.upsert({
          where: { itemId },
          create: {
            itemId,
            objects: analysis.objects,
            ocrText: analysis.ocrText,
            colors: analysis.colors,
            visionData: analysis.visionData,
            captureDate,
          },
          update: {
            objects: analysis.objects,
            ocrText: analysis.ocrText,
            colors: analysis.colors,
            visionData: analysis.visionData,
            captureDate,
          },
        }),
      ]);

      logger.log("Item updated with analysis", { itemId });

      // Step 4: Generate embeddings
      logger.log("Starting embedding generation", { itemId });

      // Get signed URL for the image (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("items")
        .createSignedUrl(fileKey, 3600);

      if (urlError || !urlData) {
        throw new Error(
          `Failed to create signed URL: ${formatStorageError(urlError)}`,
        );
      }

      logger.log("Signed URL created", { itemId });

      // Generate visual embedding (CLIP via Replicate)
      logger.log("Generating visual embedding with CLIP", { itemId });

      const visualEmbedding = await generateImageEmbedding(urlData.signedUrl);

      logger.log("Visual embedding generated", {
        itemId,
        model: "clip-vit-base-patch32",
        vectorLength: visualEmbedding.length,
      });

      // Store visual embedding
      const visualVectorId = await insertVisualVector({
        itemId,
        userId,
        model: "clip-vit-base-patch32",
        embedding: visualEmbedding,
      });

      logger.log("Visual embedding stored", { itemId, visualVectorId });

      // Generate text embedding if we have text content
      const textContent = [
        ...(analysis.tags || []),
        ...(analysis.objects || []),
        analysis.ocrText,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      let textVectorId: string | null = null;

      if (textContent) {
        logger.log("Generating text embedding", {
          itemId,
          textLength: textContent.length,
        });

        const textEmbedding = await generateTextEmbedding(textContent);

        logger.log("Text embedding generated", {
          itemId,
          model: "text-embedding-3-small",
          vectorLength: textEmbedding.length,
        });

        textVectorId = await insertTextVector({
          itemId,
          userId,
          model: "text-embedding-3-small",
          embedding: textEmbedding,
        });

        logger.log("Text embedding stored", { itemId, textVectorId });
      }

      logger.log("Image analysis complete", { itemId });

      // Step 5: Sync item to smart rooms
      logger.log("Triggering smart room sync", { itemId, userId });
      await tasks.trigger<typeof syncItemToRoomsTask>("sync-item-to-rooms", {
        itemId,
        userId,
      });

      return {
        success: true,
        itemId,
        analysis: {
          title: finalTitle,
          description: analysis.description,
          tagCount: analysis.tags.length,
          objectCount: analysis.objects.length,
          hasOcr: !!analysis.ocrText,
          colorCount: analysis.colors.length,
        },
        embeddings: {
          visualVectorId,
          textVectorId,
        },
      };
    } catch (error) {
      logger.error("Image analysis failed", { itemId, error });

      // Mark item as failed
      await db.item.update({
        where: {
          id: itemId,
          userId: userId, // Multi-tenant isolation
        },
        data: { processingStatus: "failed" },
      });

      // Re-throw so Trigger.dev can retry
      throw error;
    }
  },
});
