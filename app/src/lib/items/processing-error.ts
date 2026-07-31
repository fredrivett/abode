import type { ProcessingErrorReason } from "@prisma/client";
import { SafeFetchError, SsrfBlockedError } from "@/lib/http/safe-fetch";

/**
 * Error thrown when fetching a source URL returns a non-OK HTTP status.
 * Carries the status so failures can be classified into a safe reason code
 * without string-parsing.
 */
export class FetchError extends Error {
  readonly status: number;

  constructor(status: number, url?: string) {
    super(`Failed to fetch URL: ${status}`);
    this.name = "FetchError";
    this.status = status;
    if (url) this.url = url;
  }

  url?: string;
}

/**
 * Error carrying an already-determined reason code. Use when the failure reason
 * is known at the throw site (e.g. surfaced out of a helper that can't throw)
 * so `classifyFailureReason` returns it verbatim.
 */
export class ProcessingFailure extends Error {
  readonly reason: ProcessingErrorReason;

  constructor(reason: ProcessingErrorReason, message?: string) {
    super(message ?? `Processing failed: ${reason}`);
    this.name = "ProcessingFailure";
    this.reason = reason;
  }
}

export function reasonFromStatus(status: number): ProcessingErrorReason {
  if (status === 401 || status === 403 || status === 429)
    return "source_blocked";
  if (status === 404 || status === 410) return "source_not_found";
  // 5xx and anything else server-side — usually transient, worth retrying
  return "source_unreachable";
}

// Node/undici network-level failure codes that mean we never reached the server.
const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError")
      return true;
    // fetch() surfaces connection failures as a TypeError with message "fetch failed"
    if (
      error instanceof TypeError &&
      /fetch failed|network|ECONN|timeout/i.test(error.message)
    )
      return true;
    const code = (error as { code?: unknown; cause?: { code?: unknown } }).code;
    if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) return true;
    const causeCode = (error as { cause?: { code?: unknown } }).cause?.code;
    if (typeof causeCode === "string" && NETWORK_ERROR_CODES.has(causeCode))
      return true;
  }
  return false;
}

/**
 * Map an arbitrary processing error to a safe, user-facing reason code.
 * Never returns raw error text — the raw error stays in logs/PostHog.
 */
export function classifyFailureReason(error: unknown): ProcessingErrorReason {
  if (error instanceof ProcessingFailure) return error.reason;
  if (error instanceof FetchError) return reasonFromStatus(error.status);
  // The SSRF gate refused this destination — surface it as "blocked" (checked
  // before the SafeFetchError base, which it extends).
  if (error instanceof SsrfBlockedError) return "source_blocked";
  // Other safe-fetch safety aborts (redirect cap, oversized body) — treat like
  // an unreachable source.
  if (error instanceof SafeFetchError) return "source_unreachable";
  if (isNetworkError(error)) return "source_unreachable";

  // Fallback: legacy errors thrown as `Failed to fetch URL: <status>`
  if (error instanceof Error) {
    const match = error.message.match(/Failed to fetch URL: (\d{3})/);
    if (match) return reasonFromStatus(Number(match[1]));
  }

  return "unknown";
}
