import { logger } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import {
  classifyFailureReason,
  isPermanentFailure,
} from "../src/lib/items/processing-error";
import { captureServerException } from "../src/lib/posthog-server";

/** An item task's payload; `url`/`fileKey` say which source or file failed */
type ItemPayload = {
  itemId: string;
  userId: string;
  url?: string;
  fileKey?: string;
};

/** Log and report an item task's final failure, without touching the item */
export function reportItemFailure({
  task,
  payload,
  error,
}: {
  task: string;
  payload: ItemPayload;
  error: unknown;
}): void {
  const { itemId, userId, url, fileKey } = payload;
  logger.error("Item processing failed", { task, itemId, error });
  captureServerException(error, userId, {
    task,
    itemId,
    ...(url && { url }),
    ...(fileKey && { fileKey }),
  });
}

/**
 * Failure hooks for a task whose run backs a user-visible item; spread them
 * into the task config.
 *
 * The item turns `failed` in `onFailure`, which Trigger calls only once no
 * attempt is left. Marking it in the run's catch showed a red card while a
 * retry was still queued, hid that retry's success from the grid poll (which
 * only follows `processing` items) and let Retry start a second paid run beside
 * it. Until then the item stays `processing`, so Retry stays closed.
 *
 * A completed item is left as it is: user-initiated runs move the item to
 * `processing` before they start, so a completed item means a later stage or a
 * background re-run (admin reprocess, cover swap) failed, and the item's
 * earlier result still stands.
 *
 * `catchError` stops retrying a failure that can't succeed on another attempt
 * (a 403/404 source, unusable content), so it's fetched and reported once.
 *
 * Trigger skips `onFailure` for a run stopped at `maxDuration`, crashed,
 * cancelled or expired in the queue; those stay `processing` until the
 * stuck-items reaper marks them `stalled`.
 */
export function itemFailureHooks(task: string) {
  return {
    catchError: ({ error }: { error: unknown }) =>
      isPermanentFailure(error) ? { skipRetrying: true } : undefined,
    onFailure: async ({
      payload,
      error,
    }: {
      payload: ItemPayload;
      error: unknown;
    }) => {
      reportItemFailure({ task, payload, error });
      const { itemId, userId } = payload;
      await db.item.updateMany({
        where: { id: itemId, userId, processingStatus: { not: "completed" } },
        data: {
          processingStatus: "failed",
          processingError: classifyFailureReason(error),
        },
      });
    },
  };
}
