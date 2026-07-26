/**
 * AI cost price tables + pure cost calculators.
 *
 * Numbers are hand-maintained and verified against public provider pricing
 * pages (each entry carries a source URL + `// checked YYYY-MM`). They remain
 * approximations — the Replicate figure especially — and are NOT self-policing:
 * a later reconciliation PR compares them to real invoices. When a model isn't
 * in the table the calculators return `null` so the caller can still emit an
 * event with `cost_usd: null`, and the coverage test (`prices.test.ts`) fails
 * CI if a model the code actually calls lacks a price.
 */

// https://openai.com/api/pricing/ — checked 2026-07
const OPENAI_EMBEDDING_PRICES = {
  "text-embedding-3-small": { perMillionTokens: 0.02 },
} as const;

// https://openai.com/api/pricing/ — checked 2026-07
// gpt-4o-mini is a legacy model (superseded by gpt-4.1-mini) still billed at
// its original rate. Keyed by the base model id; `openAiChatCostUsd` resolves
// dated variants (e.g. "gpt-4o-mini-2024-07-18") via longest-prefix match.
const OPENAI_CHAT_PRICES = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4.1-nano": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
} as const;

// https://replicate.com/andreasjansson/clip-features — checked 2026-07
// Flat per-run average ($0.00022, Nvidia T4, ~1s/run). NOTE: the label
// "clip-vit-base-patch32" is the value we store/emit as `model`, but the
// actually-billed Replicate model is `andreasjansson/clip-features`
// (per-second hardware billing). `.run()` returns no metrics, so this is the
// published average rather than a per-call measurement.
const REPLICATE_PRICES = {
  "clip-vit-base-patch32": { perImageUsd: 0.00022 },
} as const;

// https://cloud.google.com/vision/pricing — checked 2026-07
// NOTE: ignores the monthly free tier (first 1000 units/feature), so this
// slightly OVER-estimates while under it — fine for spend monitoring.
const GOOGLE_VISION_PRICES = {
  IMAGE_PROPERTIES: { per1000Units: 1.5 },
} as const;

type OpenAiEmbeddingModel = keyof typeof OPENAI_EMBEDDING_PRICES;
type OpenAiChatModel = keyof typeof OPENAI_CHAT_PRICES;
type ReplicateModel = keyof typeof REPLICATE_PRICES;
type GoogleVisionFeature = keyof typeof GOOGLE_VISION_PRICES;

/**
 * The model ids / features the code actually calls, grouped by calculator.
 * The coverage test iterates this and asserts each resolves to a non-null
 * price, so adding a call to a new model without pricing it fails CI.
 */
export const KNOWN_AI_MODELS = {
  openAiEmbedding: ["text-embedding-3-small"],
  openAiChat: ["gpt-4o-mini", "gpt-4.1-nano"],
  replicate: ["clip-vit-base-patch32"],
  googleVision: ["IMAGE_PROPERTIES"],
} as const;

function isOpenAiEmbeddingModel(model: string): model is OpenAiEmbeddingModel {
  return model in OPENAI_EMBEDDING_PRICES;
}

function isReplicateModel(model: string): model is ReplicateModel {
  return model in REPLICATE_PRICES;
}

function isGoogleVisionFeature(
  feature: string,
): feature is GoogleVisionFeature {
  return feature in GOOGLE_VISION_PRICES;
}

/**
 * Resolve a chat price entry, tolerating dated model variants.
 * OpenAI returns the resolved model (e.g. "gpt-4o-mini-2024-07-18") which
 * won't equal our base key, so we match the longest base id that prefixes it.
 */
function resolveChatPrice(
  model: string,
): (typeof OPENAI_CHAT_PRICES)[OpenAiChatModel] | null {
  if (model in OPENAI_CHAT_PRICES) {
    return OPENAI_CHAT_PRICES[model as OpenAiChatModel];
  }
  let best: OpenAiChatModel | null = null;
  for (const key of Object.keys(OPENAI_CHAT_PRICES) as OpenAiChatModel[]) {
    if (model.startsWith(key) && (best === null || key.length > best.length)) {
      best = key;
    }
  }
  return best ? OPENAI_CHAT_PRICES[best] : null;
}

/** Embedding cost in USD, or null if the model isn't priced. */
export function openAiEmbeddingCostUsd(
  model: string,
  totalTokens: number,
): number | null {
  if (!isOpenAiEmbeddingModel(model)) return null;
  const { perMillionTokens } = OPENAI_EMBEDDING_PRICES[model];
  return (totalTokens / 1_000_000) * perMillionTokens;
}

/** Chat/vision cost in USD, or null if the model isn't priced. */
export function openAiChatCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = resolveChatPrice(model);
  if (!price) return null;
  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}

/** Replicate per-image cost in USD, or null if the model isn't priced. */
export function replicateImageCostUsd(
  model: string,
  images = 1,
): number | null {
  if (!isReplicateModel(model)) return null;
  return REPLICATE_PRICES[model].perImageUsd * images;
}

/** Google Vision per-feature cost in USD, or null if the feature isn't priced. */
export function googleVisionCostUsd(
  feature: string,
  images = 1,
): number | null {
  if (!isGoogleVisionFeature(feature)) return null;
  return (images / 1000) * GOOGLE_VISION_PRICES[feature].per1000Units;
}
