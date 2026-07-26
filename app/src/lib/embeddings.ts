import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import Replicate from "replicate";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/embeddings");

/**
 * Model identifier stored on `item_visual_vectors.model` for CLIP visual
 * embeddings. Shared so writers (analyze-image) and readers (similar-images)
 * agree on the value.
 */
export const VISUAL_EMBEDDING_MODEL = "clip-vit-base-patch32";

/**
 * Whether Replicate (CLIP image embeddings) is configured.
 *
 * Replicate is an optional enhancement — see the graceful degradation
 * principle in AGENTS.md. Callers should skip visual-embedding work when
 * this returns false rather than letting the pipeline fail.
 */
export function isReplicateConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

let replicateClient: Replicate | null = null;
function getReplicateClient(): Replicate {
  if (replicateClient) return replicateClient;
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN");
  replicateClient = new Replicate({ auth: token });
  return replicateClient;
}

let openaiClient: OpenAI | null = null;
export function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Extracts a CLIP embedding vector from the Replicate model output.
 *
 * Handles multiple output shapes: a raw nested array, or an object with
 * an `embedding`, `embeddings`, or `features` key.
 *
 * @param output - Raw output from the Replicate CLIP model run.
 * @returns The embedding as a flat number array.
 * @throws If the output format is unrecognised or empty.
 */
export function extractClipEmbedding(output: unknown): number[] {
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error("Invalid output: expected array with at least one element");
  }

  const first = output[0];

  if (Array.isArray(first)) return first as number[];

  if (typeof first === "object" && first !== null) {
    const candidate = first as {
      embedding?: unknown;
      embeddings?: unknown;
      features?: unknown;
    };
    const embeddingData =
      candidate.embedding ?? candidate.embeddings ?? candidate.features;
    if (Array.isArray(embeddingData)) return embeddingData as number[];

    throw new Error(
      `Unexpected output format: first element is object but no embedding array found. Keys: ${Object.keys(first).join(", ")}`,
    );
  }

  throw new Error(`Unexpected output format: first element is ${typeof first}`);
}

/**
 * Normalize a vector using L2 normalization for inner product optimization
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) {
    throw new Error("Cannot normalize zero vector");
  }
  return vector.map((val) => val / magnitude);
}

/**
 * Generate CLIP embedding for an image using Replicate
 * Returns a normalized 512-dimensional vector
 *
 * @param imageUrl - URL to the image or base64 data URI
 */
export async function generateImageEmbedding(
  imageUrl: string,
): Promise<number[]> {
  try {
    log.info(
      { imageUrl: `${imageUrl.slice(0, 100)}...` },
      "Generating image embedding with CLIP",
    );

    // If it's a localhost URL, we need to fetch and convert to data URI
    let imageInput = imageUrl;
    if (
      imageUrl.startsWith("http://localhost") ||
      imageUrl.startsWith("http://127.0.0.1")
    ) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const contentType = response.headers.get("content-type") || "image/png";
      imageInput = `data:${contentType};base64,${base64}`;
    }

    // Use Replicate's CLIP model
    const modelVersion =
      "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";
    const input = { inputs: imageInput };

    const output = await getReplicateClient().run(modelVersion, { input });
    const embedding = extractClipEmbedding(output);

    // CLIP ViT-B/32 produces 768-dimensional embeddings
    const expectedDimension = 768;
    if (!embedding || embedding.length !== expectedDimension) {
      throw new Error(
        `Invalid embedding dimension: expected ${expectedDimension}, got ${embedding?.length}`,
      );
    }

    // Normalize for inner product optimization
    const normalized = normalizeVector(embedding);

    log.info(
      {
        dimension: normalized.length,
      },
      "Image embedding generated",
    );

    return normalized;
  } catch (error) {
    // Log detailed error information
    const errorDetails = {
      imageUrl,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      // For Replicate ApiError, try to extract more details
      ...(error && typeof error === "object"
        ? {
            status: (error as Record<string, unknown>).status,
            statusText: (error as Record<string, unknown>).statusText,
            response: (error as Record<string, unknown>).response,
            request: (error as Record<string, unknown>).request,
          }
        : {}),
    };
    log.error(errorDetails, "Failed to generate image embedding");
    throw error;
  }
}

export type TextEmbeddingResult = {
  embedding: number[];
  totalTokens: number;
};

/**
 * Generate text embedding using OpenAI text-embedding-3-small
 * Returns a normalized 1536-dimensional vector plus the tokens billed, so
 * callers can record usage cost.
 */
export async function generateTextEmbedding(
  text: string,
): Promise<TextEmbeddingResult> {
  try {
    log.info({ textLength: text.length }, "Generating text embedding");

    const response = await getOpenAiClient().embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    const embedding = response.data[0].embedding;

    if (!embedding || embedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension: expected 1536, got ${embedding?.length}`,
      );
    }

    // Normalize for inner product optimization
    const normalized = normalizeVector(embedding);

    log.info(
      {
        dimension: normalized.length,
        textLength: text.length,
      },
      "Text embedding generated",
    );

    return { embedding: normalized, totalTokens: response.usage.total_tokens };
  } catch (error) {
    // Log detailed error information
    const errorDetails = {
      textLength: text.length,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      // For OpenAI errors, try to extract more details
      ...(error && typeof error === "object"
        ? {
            status: (error as Record<string, unknown>).status,
            statusText: (error as Record<string, unknown>).statusText,
            response: (error as Record<string, unknown>).response,
          }
        : {}),
    };
    log.error(errorDetails, "Failed to generate text embedding");
    throw error;
  }
}

export type EmbeddingInsert = {
  itemId: string;
  userId: string;
  model: string;
  embedding: number[];
};

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

/**
 * Upsert a visual embedding vector for an item.
 * Uses ON CONFLICT to update if a vector for this (item_id, model) already exists.
 */
export async function upsertVisualVector({
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
    ON CONFLICT ("item_id", "model") DO UPDATE SET "embedding" = EXCLUDED."embedding"
  `;

  return id;
}

/**
 * Upsert a text embedding vector for an item.
 * Uses ON CONFLICT to update if a vector for this (item_id, model) already exists.
 */
export async function upsertTextVector({
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
    ON CONFLICT ("item_id", "model") DO UPDATE SET "embedding" = EXCLUDED."embedding"
  `;

  return id;
}
