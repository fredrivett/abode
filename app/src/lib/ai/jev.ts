/**
 * Jev (TypeSafe "System One" decision model) — optional item-kind refinement.
 *
 * Jev returns calibrated probabilities for typed questions instead of free text.
 * We use it for the one genuinely fuzzy item-kind decision the structural
 * heuristic gets wrong: is a metadata-less web page a long-form *article* or a
 * generic *webpage* (homepage, listing, landing page, thin about page)? See
 * `isArticleContent` in classify-item-kind.ts for the heuristic this refines.
 *
 * Optional enhancement (see AGENTS.md graceful degradation): no JEV_API_KEY →
 * skip and keep the heuristic; a configured-but-errored call → warn and keep the
 * heuristic. It must never fail URL classification.
 *
 * Text-only: Jev cannot read images, so this only refines the text web-family
 * (article/webpage) decision — never image/product/book kinds, which are decided
 * from the URL or authoritative structured metadata upstream.
 */

import { z } from "zod";
import { createLogger } from "../logger.server";

const log = createLogger("lib/ai/jev");

/** Model id (TypeSafe / OpenRouter). Stored/emitted as `model` on ai_usage. */
export const JEV_MODEL = "jev-latest";

const DEFAULT_BASE_URL = "https://api.typesafe.ai/v1";

/**
 * A metadata-less page adopts Jev's call only when it is decisive: an article
 * probability at/above HIGH or at/below LOW. The mid-band is treated as "Jev is
 * unsure" and defers to the structural heuristic. Deliberately conservative
 * until calibration is validated against our own reassignment ground truth.
 */
const ARTICLE_PROB_HIGH = 0.7;
const ARTICLE_PROB_LOW = 0.3;

/**
 * Abort a stalled request so the awaited URL classification can't hang on Jev —
 * it's meant to answer in 70-500ms; a timeout falls back to the heuristic.
 */
const JEV_TIMEOUT_MS = 5000;

/**
 * Jev prices input tokens only, and the input *is* our request payload — so when
 * a successful response omits `usage` we estimate cost from what we sent rather
 * than recording a billed call as $0 (which would drop it from spend rollups).
 * ~4 chars/token is the usual rough ratio; only used as a fallback.
 */
const ESTIMATED_CHARS_PER_TOKEN = 4;

function estimateInputTokens(requestBody: string): number {
  return Math.ceil(requestBody.length / ESTIMATED_CHARS_PER_TOKEN);
}

/** Cap the page text sent so a single call stays well within Jev's token budget. */
const MAX_CONTENT_CHARS = 6000;

/**
 * Whether Jev (TypeSafe) is configured. Callers must gate on this and keep the
 * heuristic path when it returns false, rather than letting a call throw.
 */
export function isJevConfigured(): boolean {
  return Boolean(process.env.JEV_API_KEY);
}

// Defensive parse of the decision-API response: a noul answer + token usage.
// Lenient on purpose — a shape we don't recognise falls back to the heuristic
// rather than throwing into the classification pipeline.
const JevNoulResponseSchema = z.object({
  answers: z.object({
    is_article: z.object({
      noul: z.number(),
      confidence: z.number().optional(),
    }),
  }),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional(),
});

export type JevKindArgs = {
  title: string | null;
  description: string | null;
  content: string | null;
  linkDensity: number;
  longestParagraphWords: number;
  wordCount: number;
};

export type JevKindResult = {
  /**
   * "article" | "webpage" when Jev is decisive, else null (keep the heuristic).
   * Also null when unconfigured or the call failed.
   */
  decision: "article" | "webpage" | null;
  /** Calibrated article probability (0..1), for logging. null when no call. */
  probability: number | null;
  /** Present only when a billable call was made and parsed — for cost recording. */
  usage: { inputTokens: number; outputTokens: number } | null;
  model: string | null;
};

const NO_CALL: JevKindResult = {
  decision: null,
  probability: null,
  usage: null,
  model: null,
};

/** Map a calibrated article probability to a decisive kind, or null if unsure. */
export function articleDecisionFromProbability(
  p: number,
): "article" | "webpage" | null {
  if (p >= ARTICLE_PROB_HIGH) return "article";
  if (p <= ARTICLE_PROB_LOW) return "webpage";
  return null;
}

/**
 * Ask Jev whether a page is a long-form article or a generic webpage. Returns a
 * decisive kind only when Jev is confident (see the thresholds above); otherwise
 * `decision: null` signals the caller to keep the heuristic. Never throws — any
 * failure (unconfigured, network, non-OK, bad shape) degrades to `NO_CALL`.
 */
export async function judgeArticleVsWebpage(
  args: JevKindArgs,
): Promise<JevKindResult> {
  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey) return NO_CALL;

  // `||` (not `??`) so a copied-blank `JEV_BASE_URL=""` falls back to the
  // default rather than posting to a relative `/systemone` that always fails.
  const baseUrl = process.env.JEV_BASE_URL || DEFAULT_BASE_URL;

  const state = JSON.stringify({
    title: args.title,
    description: args.description,
    content: args.content?.slice(0, MAX_CONTENT_CHARS) ?? null,
    link_density: Number(args.linkDensity.toFixed(3)),
    longest_paragraph_words: args.longestParagraphWords,
    word_count: args.wordCount,
  });

  const requestBody = JSON.stringify({
    model: JEV_MODEL,
    state,
    questions: {
      is_article: {
        type: "noul",
        instructions:
          "Is this a long-form article or blog post meant to be read as sustained prose? Answer no if it is a generic web page such as a homepage, section or landing page, product listing, link hub, or a thin about/contact page.",
      },
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/systemone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
      signal: controller.signal,
    });
  } catch (error) {
    // Covers network failures and the abort timeout above.
    log.warn({ error }, "Jev request failed — keeping heuristic kind");
    return NO_CALL;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    log.warn(
      { status: response.status },
      "Jev returned non-OK — keeping heuristic kind",
    );
    return NO_CALL;
  }

  try {
    const parsed = JevNoulResponseSchema.parse(await response.json());
    const probability = parsed.answers.is_article.noul;
    return {
      decision: articleDecisionFromProbability(probability),
      probability,
      usage: {
        // Prefer Jev's reported usage; estimate from our request only when it's
        // absent, so a billed call is never recorded at $0.
        inputTokens:
          parsed.usage?.input_tokens ?? estimateInputTokens(requestBody),
        outputTokens: parsed.usage?.output_tokens ?? 0,
      },
      model: JEV_MODEL,
    };
  } catch (error) {
    log.warn({ error }, "Jev response parse failed — keeping heuristic kind");
    return NO_CALL;
  }
}
