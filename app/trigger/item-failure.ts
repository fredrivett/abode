import { logger } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import {
  classifyFailureReason,
  isPermanentFailure,
} from "../src/lib/items/processing-error";
import { captureServerException } from "../src/lib/posthog-server";

type ItemPayload = { itemId: string; userId: string };

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
 * `catchError` stops retrying a failure that can't succeed on another attempt
 * (a 403/404 source, unusable content), so it's fetched and reported once.
 *
 * Trigger skips `onFailure` for a run stopped at `maxDuration`, crashed,
 * cancelled or expired in the queue; those stay `processing` until the
 * stuck-items reaper marks them `stalled`.
 *
 * `keepCompleted` leaves an already-completed item as it is, for a stage that
 * also re-runs against finished items (reprocess, cover swap).
 */
export function itemFailureHooks({
  task,
  keepCompleted,
}: {
  task: string;
  keepCompleted: boolean;
}) {
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
      const { itemId, userId } = payload;
      logger.error("Item processing failed", { task, itemId, error });
      captureServerException(error, userId, { task, itemId });
      await db.item.updateMany({
        where: {
          id: itemId,
          userId,
          ...(keepCompleted && { processingStatus: { not: "completed" } }),
        },
        data: {
          processingStatus: "failed",
          processingError: classifyFailureReason(error),
        },
      });
    },
  };
}
