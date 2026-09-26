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

// Garbled glyphs (glitch art, fake HUD readouts) can send the model into a
// repetition loop in ocrText until it hits max_tokens, so steer it to legible
// text only and cap the length
const OCR_INSTRUCTION =
  "- ocrText: Legible, meaningful text visible in the image, or null if there's none. Skip decorative, garbled or repeated glyphs. Keep it under 500 characters";
const NO_OCR_INSTRUCTION = "- ocrText: Always null";

function buildPrompt({ ocr }: { ocr: boolean }): string {
  return `Analyze this image and provide structured information about it.

Provide:
- title: A concise 2-6 word title that captures the essence of the image
- description: A 1-2 sentence description of what the image shows
- tags: 10-20 relevant tags/labels (nouns, concepts, themes)
- objects: Specific objects visible in the image
${ocr ? OCR_INSTRUCTION : NO_OCR_INSTRUCTION}
- dominantColors: 3-6 dominant colors, each with a common name and approximate hex code

Be specific and accurate. For colors, use common color names and provide approximate hex values.

All output (title, description, tags, objects, ocrText interpretation, color names) MUST be in English. If the image contains text in another language, transcribe it verbatim in ocrText, but write the title, description, tags, and objects in English.`;
}

/**
 * Analyze an image using OpenAI's vision capabilities (GPT-4o-mini)
 * Returns structured data including title, description, tags, objects, OCR, and colors.
 *
 * If the response is truncated at max_tokens (in practice a runaway ocrText),
 * retries once without OCR so the item still gets its title/tags/colors rather
 * than failing outright. Usage covers both calls, since both are billed.
 */
export async function analyzeImageWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg",
): Promise<OpenAIVisionAnalysisResult> {
  const client = getOpenAiClient();

  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  // Retry transient 429s (the org token-per-minute limit trips under a burst
  // of image analyses) with backoff, rather than failing the whole task.
  const requestAnalysis = ({ ocr }: { ocr: boolean }) =>
    retryTransient(
      () =>
        client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: buildPrompt({ ocr }) },
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

  // `.create()` rather than `.parse()`: parse throws on a truncated response
  // before we can read its (billed) usage
  try {
    const first = await requestAnalysis({ ocr: true });
    const truncated = first.choices[0]?.finish_reason === "length";
    if (truncated) {
      log.warn(
        "OpenAI vision hit the output token limit — retrying without OCR",
      );
    }
    const completion = truncated
      ? await requestAnalysis({ ocr: false })
      : first;

    const choice = completion.choices[0];
    if (choice?.finish_reason === "length") {
      throw new Error("OpenAI vision response truncated even without OCR");
    }
    if (!choice?.message.content) {
      throw new Error("No content in OpenAI response");
    }
    const parsed = ImageAnalysisSchema.parse(
      JSON.parse(choice.message.content),
    );
    const analysis = truncated ? { ...parsed, ocrText: null } : parsed;

    log.info({ title: analysis.title }, "OpenAI vision analysis complete");

    const calls = truncated ? [first, completion] : [completion];
    const tokens = (
      key: "prompt_tokens" | "completion_tokens" | "total_tokens",
    ) => calls.reduce((sum, call) => sum + (call.usage?.[key] ?? 0), 0);

    return {
      analysis,
      usage: {
        promptTokens: tokens("prompt_tokens"),
        completionTokens: tokens("completion_tokens"),
        totalTokens: tokens("total_tokens"),
      },
      model: completion.model,
    };
  } catch (error) {
    log.error({ error }, "OpenAI vision analysis failed");
    throw error;
  }
}
