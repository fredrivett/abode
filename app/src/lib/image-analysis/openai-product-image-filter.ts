import OpenAI from "openai";
import { z } from "zod";
import { createLogger } from "../logger.server";

const log = createLogger("lib/openai-product-image-filter");

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

const FilterResponseSchema = z.object({
  productImageIndices: z.array(z.number().int().nonnegative()),
});

type FilterArgs = {
  imageUrls: string[];
  productTitle: string | null;
  domain: string;
};

/**
 * Asks gpt-4.1-nano to identify which of the candidate image URLs are clear
 * photos of the product itself, dropping logos, ads, recommendations, banners,
 * navigation tiles, and unrelated products.
 *
 * Uses `detail: "low"` (85 tokens flat per image) for cost efficiency — at
 * ~$0.05/M input we pay roughly $0.0001 per call regardless of candidate count.
 *
 * Returns indices into the input array (deduped, in input order). On any
 * failure — bad JSON, API error, missing key — falls back to returning every
 * index so the caller can proceed with all candidates rather than blocking
 * the pipeline.
 */
export async function selectProductImagesWithLLM({
  imageUrls,
  productTitle,
  domain,
}: FilterArgs): Promise<number[]> {
  const allIndices = imageUrls.map((_, i) => i);
  if (imageUrls.length <= 1) return allIndices;

  const titleLine = productTitle
    ? `Product: "${productTitle}" from ${domain}.`
    : `Product page from ${domain}.`;

  const prompt = `${titleLine}

You are filtering candidate images scraped from this product page. Return JSON {"productImageIndices": number[]} listing the 0-based indices of images that are clear photos of THE product itself.

Keep:
- The product itself, from any angle (front, back, side, detail shots)
- Different colorways or variants of the same product
- The product shown in use or in a styled scene (lifestyle photos)

Drop:
- Logos, brand marks, payment badges, social media icons
- Banners, promotional graphics, sale tiles
- Navigation thumbnails, category tiles
- Other products (recommendations, "you might also like", related items)
- Reviews, user-generated content, blog post thumbnails
- Pure decoration (textures, patterns, abstract graphics)

Order matters: list the cleanest hero shot first if you can identify one, but don't agonise over ordering — focus on getting the keep/drop right. If unsure about an image, include it. If no images clearly show the product, return {"productImageIndices": []}.`;

  try {
    const client = getOpenAiClient();
    const response = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageUrls.map(
              (url) =>
                ({
                  type: "image_url" as const,
                  image_url: { url, detail: "low" as const },
                }) satisfies OpenAI.Chat.ChatCompletionContentPartImage,
            ),
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      log.warn(
        { domain, candidateCount: imageUrls.length },
        "LLM filter returned empty content, falling back to all candidates",
      );
      return allIndices;
    }

    const parsed = FilterResponseSchema.parse(JSON.parse(content));
    const validIndices = Array.from(
      new Set(parsed.productImageIndices.filter((i) => i < imageUrls.length)),
    );

    log.info(
      {
        domain,
        candidateCount: imageUrls.length,
        keptCount: validIndices.length,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      },
      "LLM filter complete",
    );

    return validIndices.length > 0 ? validIndices : allIndices;
  } catch (error) {
    log.error(
      { error, domain, candidateCount: imageUrls.length },
      "LLM product-image filter failed, falling back to all candidates",
    );
    return allIndices;
  }
}
