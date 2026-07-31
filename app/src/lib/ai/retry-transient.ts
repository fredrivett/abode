import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/ai/retry-transient");

/**
 * Whether an AI-provider error is worth retrying: rate limits (429), server
 * errors (5xx), and errors with no HTTP status (network/timeouts). Client errors
 * like 401 (bad key) or 422 (bad input) are permanent — retrying just wastes
 * time. Both the OpenAI and Replicate SDKs surface `.status`, so one predicate
 * covers both.
 */
export function isTransientAiError(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== "number") return true;
  return status === 429 || status >= 500;
}

const DEFAULT_MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an AI-provider call with exponential backoff on transient failures, so a
 * rate-limited (429) or briefly-unavailable provider recovers instead of failing
 * the surrounding work. Non-transient errors throw immediately.
 *
 * Backoff grows 1s → 2s → 4s → … (capped at 15s) so it can ride out a per-minute
 * token-rate limit, not just a momentary blip.
 *
 * @param fn - The provider call to run.
 * @param options.label - Name used in retry logs (e.g. "OpenAI vision").
 * @param options.maxAttempts - Total attempts before giving up (default 4).
 * @param options.sleepFn - Injectable delay (tests pass a no-op).
 */
export async function retryTransient<T>(
  fn: () => Promise<T>,
  options: {
    label?: string;
    maxAttempts?: number;
    sleepFn?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const {
    label = "AI",
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    sleepFn = sleep,
  } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isTransientAiError(error)) throw error;
      const backoffMs = Math.min(15_000, 1_000 * 2 ** (attempt - 1));
      const jitterMs = Math.random() * 500;
      log.warn(
        { label, attempt, maxAttempts, backoffMs },
        `${label} call failed with a transient error, retrying`,
      );
      await sleepFn(backoffMs + jitterMs);
    }
  }
  throw lastError;
}
