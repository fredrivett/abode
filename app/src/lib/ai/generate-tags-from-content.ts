import { encodingForModel } from "js-tiktoken";
import { z } from "zod";
import { getOpenAiClient } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/ai/generate-tags");

const enc = encodingForModel("text-embedding-3-small");

const TagsSchema = z.object({
  tags: z
    .array(z.string())
    .describe("10-15 relevant tags/labels for the content"),
});

/**
 * Truncate text to fit within a token limit for the embedding model.
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const tokens = enc.encode(text);
  if (tokens.length <= maxTokens) return text;
  return enc.decode(tokens.slice(0, maxTokens));
}

/**
 * Generate tags from text content using gpt-4o-mini.
 * Returns 10-15 tags as a string array.
 */
export async function generateTagsFromText(text: string): Promise<string[]> {
  const client = getOpenAiClient();

  const truncatedText = truncateToTokenLimit(text, 4000);

  log.info(
    { textLength: text.length, truncatedLength: truncatedText.length },
    "Generating tags from text",
  );

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Analyze the following content and generate tags for it.

Return a JSON object with a "tags" field containing an array of 10-15 relevant tags/labels (nouns, concepts, themes). Be specific and accurate.

Content:
${truncatedText}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  const parsed = JSON.parse(content);
  const result = TagsSchema.parse(parsed);

  log.info({ tagCount: result.tags.length }, "Tags generated from text");

  return result.tags;
}
