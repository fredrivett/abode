import type { enrichItemTask } from "@app/trigger/enrich-item";
import { truncateToTokenLimit } from "@/lib/ai/generate-tags-from-content";
import db from "@/lib/db";
import { enqueueBackgroundProcessing } from "@/lib/items/enqueue-background-processing";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("lib/items/resume-deferred-items");

// Bound a single sweep's work so the scheduled run stays well within maxDuration.
// A user's realistic headroom per day is a fraction of the bucket limit, so these
// caps are generous; anything beyond them waits for the next daily sweep.
const MAX_USERS_PER_SWEEP = 500;
const MAX_ITEMS_PER_USER_PER_SWEEP = 500;

const EMBEDDING_TOKEN_LIMIT = 8191;

type DeferredItem = {
  id: string;
  userId: string;
  title: string | null;
  description: string | null;
  bookDetails: { authors: string[] } | null;
};

/**
 * Reconstruct the work to resume for a deferred item. Deferred items today are
 * imported books awaiting enrichment, so we rebuild the `enrich-item` payload
 * from the item — the same `sourceText` `handleBookUrl` builds (title + authors +
 * description). This is the single extension point if a second kind of deferred
 * work is ever introduced.
 */
function buildEnrichResume(item: DeferredItem) {
  const sourceText = [
    item.title,
    item.bookDetails?.authors.join(", "),
    item.description,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: "enrich-item" as const,
    payload: {
      itemId: item.id,
      userId: item.userId,
      sourceText: truncateToTokenLimit(sourceText, EMBEDDING_TOKEN_LIMIT),
    },
    bucket: "ingestion" as const,
  };
}

/**
 * Daily sweep: re-enqueue `deferred` items (oldest first, per user) while the
 * user still has interactive-reserve headroom.
 *
 * Each item is fed through {@link enqueueBackgroundProcessing} — the single
 * authority that re-checks the budget and either enqueues + draws down the count
 * or re-defers. Once a user's headroom is exhausted (a `deferred` result) we stop
 * feeding that user and leave the remainder parked for the next day's sweep, so a
 * large import trickles out across days without ever consuming a user's
 * interactive reserve.
 */
export async function resumeDeferredItems(): Promise<{
  enqueued: number;
  stillDeferred: number;
}> {
  // Group by user (ordered by each user's oldest deferred item) rather than
  // `distinct` over a row LIMIT — otherwise one user with more deferred rows than
  // the cap could fill it and starve everyone else until later sweeps.
  const users = await db.item.groupBy({
    by: ["userId"],
    where: { processingStatus: "deferred" },
    _min: { createdAt: true },
    orderBy: { _min: { createdAt: "asc" } },
    take: MAX_USERS_PER_SWEEP,
  });

  let enqueued = 0;
  let stillDeferred = 0;

  for (const { userId } of users) {
    const items = await db.item.findMany({
      where: { processingStatus: "deferred", userId },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        bookDetails: { select: { authors: true } },
      },
      orderBy: { createdAt: "asc" },
      take: MAX_ITEMS_PER_USER_PER_SWEEP,
    });

    for (let i = 0; i < items.length; i++) {
      const { id, payload, bucket } = buildEnrichResume(items[i]);
      try {
        const result = await enqueueBackgroundProcessing<typeof enrichItemTask>(
          {
            id,
            payload,
            userId,
            bucket,
          },
        );
        if (result.status === "deferred") {
          // User is out of headroom — leave this item and the rest parked.
          stillDeferred += items.length - i;
          break;
        }
        // "skipped" = another worker already claimed it; count neither, continue.
        if (result.status === "enqueued") enqueued += 1;
      } catch (error) {
        // enqueueBackgroundProcessing already rolled the item back to `deferred`
        // and released its slot; report so a persistent failure is visible and
        // leave it for the next sweep.
        log.error(
          { error, itemId: items[i].id },
          "Failed to resume deferred item",
        );
        captureServerException(error, userId, {
          task: "resume-deferred-items",
          itemId: items[i].id,
        });
        stillDeferred += 1;
      }
    }
  }

  log.info(
    { enqueued, stillDeferred, users: users.length },
    "Resumed deferred items",
  );
  return { enqueued, stillDeferred };
}
