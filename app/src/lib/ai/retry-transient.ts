import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/ai/retry-transient");

// Network/timeout failures carry no HTTP status but are still worth retrying.
// Recognise them by Node/undici error code or SDK connection-error class name,
// walking the `cause` chain (fetch surfaces the real code on a nested cause).
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);
const RETRYABLE_ERROR_NAMES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "AbortError",
  "TimeoutError",
]);

function isNetworkError(error: object): boolean {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth++
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code))
      return true;
    const name = (current as { name?: unknown }).name;
    if (typeof name === "string" && RETRYABLE_ERROR_NAMES.has(name))
      return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// The HTTP status lives in different places per SDK: OpenAI puts it on `.status`,
// Replicate's ApiError on `.response.status`. Check both so a Replicate 429/5xx
// isn't mistaken for a status-less error and dropped from retry.
function httpStatus(error: object): number | undefined {
  const direct = (error as { status?: unknown }).status;
  if (typeof direct === "number") return direct;
  const response = (error as { response?: unknown }).response;
  if (response && typeof response === "object") {
    const responseStatus = (response as { status?: unknown }).status;
    if (typeof responseStatus === "number") return responseStatus;
  }
  return undefined;
}

/**
 * Whether an AI-provider error is worth retrying: rate limits (429), server
 * errors (5xx), and recognised network/timeout errors. Everything else is
 * treated as permanent — a client error (401 bad key, 422 bad input) or a
 * deterministic failure with no HTTP status (a schema/length/content-filter
 * parse error) would just fail again and re-burn tokens.
 */
export function isTransientAiError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = httpStatus(error);
  if (typeof status === "number") return status === 429 || status >= 500;
  // No HTTP status: retry only genuine network/timeout errors, not deterministic
  // failures (which would repeat forever and waste tokens).
  return isNetworkError(error);
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
