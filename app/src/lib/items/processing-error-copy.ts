import type { ProcessingErrorReason } from "@prisma/client";

export type ProcessingErrorCopy = {
  message: string;
  /** Whether retrying could plausibly succeed. Blocked/not-found/unsupported won't. */
  retryable: boolean;
};

const COPY: Record<ProcessingErrorReason, ProcessingErrorCopy> = {
  source_blocked: {
    message:
      "This site blocked us from reading it — common with paywalled or bot-protected pages. The link is saved; you can add a title and notes yourself.",
    retryable: false,
  },
  source_not_found: {
    message: "This page couldn't be found — it may have moved or been removed.",
    retryable: false,
  },
  source_unreachable: {
    message:
      "We couldn't reach this site. It may be temporarily down — try again shortly.",
    retryable: true,
  },
  unsupported_content: {
    message: "We couldn't read this type of content.",
    retryable: false,
  },
  stalled: {
    message: "Processing didn't finish and was stopped — please try again.",
    retryable: true,
  },
  enqueue_failed: {
    message: "We couldn't start processing this — please try again.",
    retryable: true,
  },
  unknown: {
    message: "Analysis failed. You can retry or delete the item.",
    retryable: true,
  },
};

/** Resolve safe, user-facing copy for a failure reason. Defaults to the generic message. */
export function getProcessingErrorCopy(
  reason: ProcessingErrorReason | null | undefined,
): ProcessingErrorCopy {
  return reason ? COPY[reason] : COPY.unknown;
}
