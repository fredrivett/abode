import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAiClient } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/ai/translate-to-english");

const TranslationSchema = z.object({
  english: z.string().describe("The text translated into English"),
});

/**
 * Translate text into English. If the input is already English, returns it
 * unchanged. Preserves URLs, hashtags, mentions, and emoji.
 */
export async function translateToEnglish(text: string): Promise<string> {
  const client = getOpenAiClient();

  const completion = await client.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Translate the following text into natural English.

Rules:
- If the text is already in English, return it unchanged.
- Preserve URLs, @mentions, #hashtags, and emoji exactly as they appear.
- Keep the translation concise and faithful to the original tone.

Text:
${text}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.2,
    response_format: zodResponseFormat(TranslationSchema, "translation"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error("No parsed content in OpenAI response");
  }

  log.info(
    { inputLength: text.length, outputLength: parsed.english.length },
    "Translated text to English",
  );

  return parsed.english;
}
