import OpenAI from "openai";
import { z } from "zod";
import { createLogger } from "../logger.server";

const log = createLogger("lib/openai-vision");

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

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

Return a JSON object with these fields:
- title: A concise 2-6 word title that captures the essence of the image
- description: A 1-2 sentence description of what the image shows
- tags: An array of 10-20 relevant tags/labels (nouns, concepts, themes)
- objects: An array of specific objects visible in the image
- ocrText: Any text visible in the image, or null if there's no text
- dominantColors: An array of 3-6 dominant colors, each with a "name" (common color name) and "hex" (approximate hex code)

Be specific and accurate. For colors, use common color names and provide approximate hex values.

All output (title, description, tags, objects, ocrText interpretation, color names) MUST be in English. If the image contains text in another language, transcribe it verbatim in ocrText, but write the title, description, tags, and objects in English.`;

  try {
    const response = await client.chat.completions.create({
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
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const parsed = JSON.parse(content);
    const analysis = ImageAnalysisSchema.parse(parsed);

    log.info({ title: analysis.title }, "OpenAI vision analysis complete");

    return {
      analysis,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
    };
  } catch (error) {
    log.error({ error }, "OpenAI vision analysis failed");
    throw error;
  }
}
