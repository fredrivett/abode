import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { retryTransient } from "../ai/retry-transient";
import { getOpenAiClient } from "../embeddings";
import { createLogger } from "../logger.server";

const log = createLogger("lib/openai-vision");

const ImageAnalysisSchema = z.object({
  title: z.string().describe("A concise 2-6 word title for the image"),
  description: z
    .string()
    .describe("A 1-2 sentence description of what the image contains"),
  tags: z
    .array(z.string())
    .describe("10-20 relevant tags/labels for the image"),
  objects: z
    .array(z.string())
    .describe("List of specific objects visible in the image"),
  ocrText: z
    .string()
    .nullable()
    .describe("Any text visible in the image, or null if no text"),
  dominantColors: z
    .array(
      z.object({
        name: z.string().describe("Common color name (e.g. red, blue, teal)"),
        hex: z.string().describe("Approximate hex color code"),
      }),
    )
    .describe("3-6 dominant colors in the image"),
});

export type OpenAIVisionResult = z.infer<typeof ImageAnalysisSchema>;

export type OpenAIVisionAnalysisResult = {
  analysis: OpenAIVisionResult;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
};

/**
 * Analyze an image using OpenAI's vision capabilities (GPT-4o-mini)
 * Returns structured data including title, description, tags, objects, OCR, and colors
 */
export async function analyzeImageWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg",
): Promise<OpenAIVisionAnalysisResult> {
  const client = getOpenAiClient();

  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const prompt = `Analyze this image and provide structured information about it.

Provide:
- title: A concise 2-6 word title that captures the essence of the image
- description: A 1-2 sentence description of what the image shows
- tags: 10-20 relevant tags/labels (nouns, concepts, themes)
- objects: Specific objects visible in the image
- ocrText: Any text visible in the image, or null if there's no text
- dominantColors: 3-6 dominant colors, each with a common name and approximate hex code

Be specific and accurate. For colors, use common color names and provide approximate hex values.

All output (title, description, tags, objects, ocrText interpretation, color names) MUST be in English. If the image contains text in another language, transcribe it verbatim in ocrText, but write the title, description, tags, and objects in English.`;

  try {
    // Retry transient 429s (the org token-per-minute limit trips under a burst
    // of image analyses) with backoff, rather than failing the whole task.
    const completion = await retryTransient(
      () =>
        client.chat.completions.parse({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.3,
          response_format: zodResponseFormat(
            ImageAnalysisSchema,
            "image_analysis",
          ),
        }),
      { label: "OpenAI vision" },
    );

    const analysis = completion.choices[0]?.message?.parsed;
    if (!analysis) {
      throw new Error("No parsed content in OpenAI response");
    }

    log.info({ title: analysis.title }, "OpenAI vision analysis complete");

    return {
      analysis,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
      model: completion.model,
    };
  } catch (error) {
    log.error({ error }, "OpenAI vision analysis failed");
    throw error;
  }
}
