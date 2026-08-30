import vision from "@google-cloud/vision";
import { getNearestColorName, hexToLab } from "./search/color-utils";
import type { ImageColor } from "./types/item";

export type { ImageColor } from "./types/item";

/**
 * Whether Google Cloud Vision (dominant-colour extraction) is configured.
 *
 * Google Vision is an optional enhancement — see the graceful degradation
 * principle in AGENTS.md. Callers should skip colour analysis when this returns
 * false rather than letting `getVisionClient()` throw at call time (the client
 * otherwise falls through to ambient ADC and errors on a minimal deploy).
 */
export function isGoogleVisionConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_CREDENTIALS_PATH,
  );
}

function parseCredentials(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (error) {
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

function getVisionClient() {
  const rawCredentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
  const credentials = rawCredentials
    ? parseCredentials(rawCredentials)
    : undefined;

  return new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_CLOUD_CREDENTIALS_PATH,
    credentials,
  });
}

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
 * Extract only color information from an image using Google Cloud Vision API.
 * Uses only IMAGE_PROPERTIES feature ($1.50/1000 vs $6.75/1000 for all features).
 */
export async function analyzeImageColorsOnly(
  imageBuffer: Buffer,
): Promise<ImageColor[]> {
  const client = getVisionClient();

  const [result] = await client.annotateImage({
    image: { content: imageBuffer },
    features: [{ type: "IMAGE_PROPERTIES" }],
  });

  const colors: ImageColor[] =
    result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.map((color) => {
        const hex = rgbToHex(
          color.color?.red || 0,
          color.color?.green || 0,
          color.color?.blue || 0,
        );
        const name = getNearestColorName(hex);
        const lab = hexToLab(hex);
        return {
          hex,
          name: name || "unknown",
          score: color.score || 0,
          ...(lab && { l: lab.l, a: lab.a, b: lab.b }),
        };
      })
      .filter((c) => c.name !== "unknown") || [];

  return colors;
}
