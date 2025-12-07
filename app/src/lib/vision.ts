import vision from "@google-cloud/vision";

// Initialize the Vision API client
function getVisionClient() {
  const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS
    ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
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
  ocrText?: string;
  colors: Array<{ hex: string; score: number }>;
  visionData: unknown;
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

  // Extract objects (concrete physical things)
  const objects =
    result.localizedObjectAnnotations?.map((obj) => obj.name || "") || [];

  // Extract OCR text
  const ocrText = result.textAnnotations?.[0]?.description || undefined;

  // Extract dominant colors
  const colors =
    result.imagePropertiesAnnotation?.dominantColors?.colors?.map((color) => ({
      hex: rgbToHex(
        color.color?.red || 0,
        color.color?.green || 0,
        color.color?.blue || 0,
      ),
      score: color.score || 0,
    })) || [];

  // Generate a title from the top labels
  const title = labels.slice(0, 3).join(", ");

  // Generate a description from labels and objects
  const description = generateDescription(labels, objects, ocrText);

  return {
    title,
    description,
    tags: labels,
    objects,
    ocrText,
    colors,
    visionData: result, // Store full response for debugging/future use
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
        return hex.length === 1 ? "0" + hex : hex;
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
  ocrText?: string,
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
