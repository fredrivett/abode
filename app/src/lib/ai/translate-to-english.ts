import type { ItemKind } from "@prisma/client";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { recordAiUsage } from "@/lib/ai-costs/record-ai-usage";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/ai/translate-to-english");
const TRANSLATION_MODEL = "gpt-4o-mini";

const TranslationSchema = z.object({
  english: z.string().describe("The text translated into English"),
});

/** Item/user context so the paid translation call is attributed in cost reporting. */
type TranslationUsageContext = {
  userId: string;
  itemId?: string;
  itemKind?: ItemKind | null;
};

/**
 * Translate text into English. If the input is already English, returns it
 * unchanged. Preserves URLs, hashtags, mentions, and emoji.
 *
 * `usageContext` attributes the (paid) gpt-4o-mini call in AI cost reporting —
 * every paid call site must be priced.
 */
export async function translateToEnglish(
  text: string,
  usageContext: TranslationUsageContext,
): Promise<string> {
  // Optional enhancement — when OpenAI is unconfigured, return the text as-is
  // (the caller already treats a failed translation as "use the original").
  if (!isOpenAiConfigured()) {
    log.info("OpenAI not configured — returning text untranslated");
    return text;
  }

  const client = getOpenAiClient();

  const completion = await client.chat.completions.parse({
    model: TRANSLATION_MODEL,
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

  // Record usage before the parsed-content guard: the call is billed whether or
  // not the response parsed, so spend must be attributed even when we throw.
  recordAiUsage({
    userId: usageContext.userId,
    itemId: usageContext.itemId,
    itemKind: usageContext.itemKind ?? null,
    provider: "openai",
    operation: "translation",
    model: TRANSLATION_MODEL,
    inputTokens: completion.usage?.prompt_tokens,
    outputTokens: completion.usage?.completion_tokens,
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
