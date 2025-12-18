import vision from "@google-cloud/vision";
import type { Prisma } from "@prisma/client";
import OpenAI from "openai";
import { createLogger } from "./logger.server";
import { getNearestColorName } from "./search/color-utils";

const log = createLogger("lib/vision");

export type ImageColor = { hex: string; name: string; score: number };

function parseCredentials(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Only include a short preview to avoid leaking secrets in logs
    const preview = raw.slice(0, 200);
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "Unknown JSON parse error";
    throw new Error(
      `Invalid GOOGLE_CLOUD_CREDENTIALS JSON: ${reason}. Preview: ${preview}`,
    );
  }
}

// Initialize the Vision API client
function getVisionClient() {
  const rawCredentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
  const credentials = rawCredentials
    ? parseCredentials(rawCredentials)
    : undefined;

  return new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_CLOUD_CREDENTIALS_PATH,
    credentials, // Takes precedence if set
  });
}

export type ImageAnalysisResult = {
  title?: string;
  description?: string;
  tags: string[];
  objects: string[];
  ocrText: string | null;
  colors: ImageColor[];
  visionData: Prisma.InputJsonValue;
};

/**
 * Analyze an image using Google Cloud Vision API
 * @param imageBuffer - The image file as a Buffer
 * @returns Structured analysis results
 */
export async function analyzeImage(
  imageBuffer: Buffer,
): Promise<ImageAnalysisResult> {
  const client = getVisionClient();

  const [result] = await client.annotateImage({
    image: { content: imageBuffer },
    features: [
      { type: "LABEL_DETECTION", maxResults: 20 },
      { type: "OBJECT_LOCALIZATION", maxResults: 10 },
      { type: "TEXT_DETECTION" },
      { type: "IMAGE_PROPERTIES" },
    ],
  });

  // Extract labels (general tags and concepts)
  const labels =
    result.labelAnnotations?.map((label) => label.description || "") || [];
  const filteredLabels = uniqueStrings(
    labels.filter((label) => {
      const normalized = label.toLowerCase();
      return normalized !== "screenshot" && normalized !== "text";
    }),
  );

  // Extract objects (concrete physical things)
  const objects = uniqueStrings(
    result.localizedObjectAnnotations?.map((obj) => obj.name || "") || [],
  );

  // Extract OCR text
  const ocrText = result.textAnnotations?.[0]?.description || null;

  // Extract dominant colors with nearest named color
  const colors: ImageColor[] =
    result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.map((color) => {
        const hex = rgbToHex(
          color.color?.red || 0,
          color.color?.green || 0,
          color.color?.blue || 0,
        );
        const name = getNearestColorName(hex);
        return {
          hex,
          name: name || "unknown",
          score: color.score || 0,
        };
      })
      .filter((c) => c.name !== "unknown") || [];

  // Prefer OCR-derived title; fallback to filtered labels
  const title =
    getOcrTitle(ocrText) || filteredLabels.slice(0, 3).join(", ") || undefined;

  // Generate a description from labels and objects
  const description = generateDescription(filteredLabels, objects, ocrText);

  return {
    title,
    description,
    tags: filteredLabels,
    objects,
    ocrText,
    colors,
    visionData: JSON.parse(JSON.stringify(result)), // Store full response for debugging/future use
  };
}

/**
 * Convert RGB to hex color code
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      })
      .join("")
  );
}

/**
 * Generate a human-readable description from analysis results
 */
function generateDescription(
  labels: string[],
  objects: string[],
  ocrText: string | null,
): string {
  const parts: string[] = [];

  // Add object description
  if (objects.length > 0) {
    parts.push(`Image contains: ${objects.slice(0, 3).join(", ")}`);
  }

  // Add labels/themes
  if (labels.length > 0) {
    parts.push(`Themes: ${labels.slice(0, 5).join(", ")}`);
  }

  // Add OCR preview if present
  if (ocrText && ocrText.length > 0) {
    const preview = ocrText.slice(0, 100);
    parts.push(`Text: "${preview}${ocrText.length > 100 ? "..." : ""}"`);
  }

  return parts.join(". ");
}

function getOcrTitle(ocrText: string | null) {
  if (!ocrText) return undefined;
  const firstLine = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  if (!firstLine) return undefined;
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export type GenerateTitleInput = {
  originalFilename?: string;
  labels: string[];
  objects: string[];
  ocrText: string | null;
};

/**
 * Build context parts for the AI title generation prompt.
 * Exported for testing.
 */
export function buildTitleContextParts(input: GenerateTitleInput): string[] {
  const { originalFilename, labels, objects, ocrText } = input;
  const contextParts: string[] = [];

  if (originalFilename) {
    contextParts.push(`Original filename: ${originalFilename}`);
  }

  if (labels.length > 0) {
    contextParts.push(
      `Detected labels/themes: ${labels.slice(0, 10).join(", ")}`,
    );
  }

  if (objects.length > 0) {
    contextParts.push(`Detected objects: ${objects.join(", ")}`);
  }

  if (ocrText) {
    const preview = ocrText.slice(0, 200);
    contextParts.push(
      `Text in image: ${preview}${ocrText.length > 200 ? "..." : ""}`,
    );
  }

  return contextParts;
}

/**
 * Build the full prompt for AI title generation.
 * Exported for testing.
 */
export function buildTitlePrompt(contextParts: string[]): string {
  return `Based on the following information about an image, suggest a concise and descriptive title (2-6 words). The title should be human-friendly and capture the essence of what the image contains or represents.

${contextParts.join("\n")}

Respond with ONLY the title, nothing else. Do not include quotes, periods, or any other punctuation at the end.`;
}

/**
 * Process an AI-generated title (trim, truncate if needed).
 * Exported for testing.
 */
export function processAITitle(
  rawTitle: string | null | undefined,
): string | null {
  if (!rawTitle) {
    return null;
  }

  const title = rawTitle.trim();

  if (title.length === 0) {
    return null;
  }

  // Truncate if too long
  if (title.length > 80) {
    return `${title.slice(0, 77)}...`;
  }

  return title;
}

/**
 * Generate an AI-suggested title for an image based on analysis data and original filename.
 * Uses OpenAI GPT-4o-mini to generate a concise, descriptive title.
 */
export async function generateAITitle(
  input: GenerateTitleInput,
): Promise<string | null> {
  const contextParts = buildTitleContextParts(input);

  if (contextParts.length === 0) {
    return null;
  }

  const prompt = buildTitlePrompt(contextParts);

  try {
    const client = getOpenAiClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.7,
    });

    const title = processAITitle(response.choices[0]?.message?.content);

    if (title) {
      log.info(
        { originalFilename: input.originalFilename, generatedTitle: title },
        "AI title generated",
      );
    }

    return title;
  } catch (error) {
    log.error(
      { error, originalFilename: input.originalFilename },
      "Failed to generate AI title, falling back to default",
    );
    return null;
  }
}
