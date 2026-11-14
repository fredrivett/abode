import { extname } from "node:path";
import { inspect } from "node:util";
import type { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { truncateToTokenLimit } from "../src/lib/ai/generate-tags-from-content";
import db from "../src/lib/db";
import {
  upsertVisualVector,
  VISUAL_EMBEDDING_MODEL,
} from "../src/lib/embeddings";
import { extractExifData } from "../src/lib/exif";
import { analyzeImageBytes } from "../src/lib/image-analysis/analyze-image-bytes";
import { buildImageDetailsUpdate } from "../src/lib/image-analysis/image-details-write";
import { markProcessingActive } from "../src/lib/items/mark-processing-active";
import { classifyFailureReason } from "../src/lib/items/processing-error";
import { visionMayWriteTitle } from "../src/lib/items/vision-title";
import { captureServerException } from "../src/lib/posthog-server";
import { reverseGeocode } from "../src/lib/reverse-geocode";
import type { enrichItemTask } from "./enrich-item";
import { imageAnalysisQueue } from "./queues";

type AnalyzeImagePayload = {
  itemId: string;
  userId: string;
  fileKey: string;
  /** Item text (e.g. a book's title and description) blended into the enrichment sourceText. */
  extraSourceText?: string;
};

const EMBEDDING_TOKEN_LIMIT = 8191;

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
};

export function getMimeTypeFromFileKey(fileKey: string): string {
  const ext = extname(fileKey).toLowerCase();
  return EXTENSION_TO_MIME[ext] || "image/jpeg";
}

export function getSupabaseConfig() {
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

export function formatStorageError(error: unknown) {
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

/**
 * Image processing pipeline: downloads the image from Supabase Storage,
 * extracts EXIF/GPS data, runs color analysis and OpenAI Vision in parallel,
 * generates CLIP visual embedding, then triggers enrich-item for tags +
 * text embedding + room sync.
 *
 * For a book or product cover this is the item's only enrichment: the item's
 * text arrives as `extraSourceText` and is blended with the cover's objects/OCR,
 * so no separate text-only enrich races it for tags and the text vector. The
 * cover is an enhancement there, so once its analysis has failed for good the
 * item is enriched from its text alone rather than left without tags.
 *
 * Marks a not-yet-completed item `failed` on error so the UI can show
 * processing status; a reprocess must not regress a completed item.
 */
export const analyzeImageTask = task({
  id: "analyze-image",
  retry: { maxAttempts: 2 },
  queue: imageAnalysisQueue,
  maxDuration: 600, // 10 minutes should be plenty for Vision + embeddings
  onFailure: async ({ payload }: { payload: AnalyzeImagePayload }) => {
    if (payload.extraSourceText) await enrichFromItemText(payload);
  },
  run: async (payload: AnalyzeImagePayload) => {
    const { itemId, userId, fileKey, extraSourceText } = payload;

    // Advance the reaper clock — first pipeline stage
    await markProcessingActive(itemId);

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

      // Step 2: Run the shared vision pipeline (colours + OpenAI Vision + CLIP)
      logger.log("Analyzing image with hybrid approach", { itemId });

      const mimeType = getMimeTypeFromFileKey(fileKey);
      const analysis = await analyzeImageBytes({
        buffer,
        mimeType,
        itemId,
        userId,
        source: "upload",
        getSignedUrl: async () => {
          // Signed URL for the image (valid for 1 hour) — CLIP needs a URL
          const { data: urlData, error: urlError } = await supabase.storage
            .from("items")
            .createSignedUrl(fileKey, 3600);
          if (urlError || !urlData) {
            throw new Error(
              `Failed to create signed URL: ${formatStorageError(urlError)}`,
            );
          }
          return urlData.signedUrl;
        },
      });

      // Step 3: Persist analysis. Only plain image uploads derive their
      // title/description from vision, and only until the user edits the title
      // (see visionMayWriteTitle). Image details are written for every kind.
      logger.log("Updating item with analysis results", { itemId });

      const item = await db.item.findFirstOrThrow({
        where: { id: itemId, userId },
        select: { kind: true, titleEditedByUser: true },
      });

      const imageDetailsUpsert = db.itemImageDetails.upsert({
        where: { itemId },
        create: {
          itemId,
          objects: analysis.objects,
          ocrText: analysis.ocrText,
          colors: analysis.colors,
          visionData: analysis.visionData,
          blurDataUrl: analysis.blurDataUrl,
          captureDate,
        },
        update: buildImageDetailsUpdate(analysis, captureDate),
      });

      if (!analysis.openaiConfigured) {
        logger.log(
          "OpenAI not configured — item captured without AI title/description/tags (existing enrichment preserved on reprocess)",
          { itemId },
        );
      }

      // Update Item and ImageDetails in a transaction for consistency. Skip the
      // vision-derived title/description write when OpenAI was unconfigured —
      // the analysis fields are empty and would otherwise clobber the item.
      const ops: Prisma.PrismaPromise<unknown>[] = [];
      if (analysis.openaiConfigured && visionMayWriteTitle(item)) {
        ops.push(
          db.item.update({
            where: {
              id: itemId,
              userId: userId, // Multi-tenant isolation
            },
            data: {
              title: analysis.title,
              description: analysis.description,
            },
          }),
        );
      }
      ops.push(imageDetailsUpsert);
      await db.$transaction(ops);

      logger.log("Item updated with analysis", { itemId });

      // Step 4: Persist the CLIP visual embedding if one was produced
      // (analyzeImageBytes returns null when Replicate is unconfigured/errored).
      // The embedding is an optional enhancement, so persisting it must not fail
      // item processing — a write error is logged/reported and swallowed.
      let visualVectorId: string | null = null;
      if (analysis.embedding) {
        try {
          visualVectorId = await upsertVisualVector({
            itemId,
            userId,
            model: analysis.embeddingModel ?? VISUAL_EMBEDDING_MODEL,
            embedding: analysis.embedding,
          });
          logger.log("Visual embedding stored", { itemId, visualVectorId });
        } catch (error) {
          logger.warn("Visual embedding persistence skipped (write error)", {
            itemId,
            error,
          });
          captureServerException(error, userId, {
            source: "analyze-image:visual-embedding",
            itemId,
          });
        }
      }

      logger.log("Image analysis complete", { itemId });

      // Step 5: Trigger enrichment (tags, text embedding, room sync). The
      // cover's text goes first so a long item description is what the token
      // limit cuts, not the cover's objects/OCR.
      const sourceText = [
        ...analysis.objects,
        analysis.ocrText,
        extraSourceText,
      ]
        .filter(Boolean)
        .join(" ");

      logger.log("Triggering item enrichment", { itemId, userId });
      await tasks.trigger<typeof enrichItemTask>("enrich-item", {
        itemId,
        userId,
        // With item text, tag from the blend so the title and description
        // shape the tags too; a plain image's vision tags are already complete
        ...(!extraSourceText && { precomputedTags: analysis.tags }),
        sourceText: truncateToTokenLimit(sourceText, EMBEDDING_TOKEN_LIMIT),
      });

      return {
        success: true,
        itemId,
        analysis: {
          title: analysis.title,
          description: analysis.description,
          tagCount: analysis.tags.length,
          objectCount: analysis.objects.length,
          hasOcr: !!analysis.ocrText,
          colorCount: analysis.colors.length,
        },
        embeddings: {
          visualVectorId,
        },
      };
    } catch (error) {
      logger.error("Image analysis failed", { itemId, error });
      captureServerException(error, userId, {
        task: "analyze-image",
        itemId,
      });

      // Mark item as failed with a safe, user-facing reason code — unless it
      // already completed (a reprocess must not regress it to failed)
      await db.item.updateMany({
        where: { id: itemId, userId, processingStatus: { not: "completed" } },
        data: {
          processingStatus: "failed",
          processingError: classifyFailureReason(error),
        },
      });

      // Re-throw so Trigger.dev can retry
      throw error;
    }
  },
});

/**
 * Enrich a book or product from its own text when its cover couldn't be
 * analysed. enrich-item completes the item, so a failed cover doesn't strand an
 * item whose title and description are fine.
 */
async function enrichFromItemText({
  itemId,
  userId,
  fileKey,
  extraSourceText,
}: AnalyzeImagePayload) {
  // A re-capture since this run was queued replaced the cover (and deleted the
  // old one, often why this run failed); the newer run enriches the item
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { coverFileKey: true },
  });
  if (item?.coverFileKey !== fileKey) {
    logger.log("Cover replaced since queued — skipping text fallback", {
      itemId,
      fileKey,
    });
    return;
  }

  logger.log("Cover analysis failed — enriching from the item's text", {
    itemId,
  });
  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
    sourceText: truncateToTokenLimit(
      extraSourceText ?? "",
      EMBEDDING_TOKEN_LIMIT,
    ),
  });
}
