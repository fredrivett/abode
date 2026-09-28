import type { enrichItemTask } from "@app/trigger/enrich-item";
import type { SupabaseClient } from "@supabase/supabase-js";
import { truncateToTokenLimit } from "@/lib/ai/generate-tags-from-content";
import db from "@/lib/db";
import type { NormalizedBook } from "@/lib/imports/types";
import { writeImportedBook } from "@/lib/imports/write-imported-book";
import { enqueueBackgroundProcessing } from "@/lib/items/enqueue-background-processing";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("lib/imports/import-book-chunk");
const EMBEDDING_TOKEN_LIMIT = 8191;

export type ImportChunkResult = {
  imported: number;
  skipped: number;
  failed: number;
  /** True if this chunk landed the final tally that completed the import. */
  completed: boolean;
};

/**
 * Write one chunk of a library's books into an in-progress `ItemImport`, then
 * atomically fold this chunk's tally onto the shared row. Chunks run concurrently
 * (one Trigger run each), so the counters use `increment` and completion is a
 * conditional, idempotent update — the chunk that accounts for the final book
 * flips `status` to `completed` (others match no rows) and reports the funnel
 * completion. Per-book failures are tallied, never thrown, so one bad book can't
 * abort the chunk.
 *
 * Each created book's enrichment is enqueued through the budget-aware background
 * path so it respects the interactive reserve (defers when the user's out of
 * headroom). Kept as a plain function (the Trigger task is a thin wrapper) so this
 * orchestration is directly testable.
 */
export async function importBookChunk({
  userId,
  importId,
  books,
  supabase,
}: {
  userId: string;
  importId: string;
  books: NormalizedBook[];
  supabase: SupabaseClient;
}): Promise<ImportChunkResult> {
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    try {
      const result = await writeImportedBook({
        userId,
        book,
        source: "literal",
        supabase,
      });
      if (result.status === "skipped") {
        skipped += 1;
        continue;
      }
      imported += 1;

      const sourceText = truncateToTokenLimit(
        [book.title, book.authors.join(", "), book.description]
          .filter(Boolean)
          .join(" "),
        EMBEDDING_TOKEN_LIMIT,
      );
      await enqueueBackgroundProcessing<typeof enrichItemTask>({
        id: "enrich-item",
        payload: { itemId: result.itemId, userId, sourceText },
        userId,
        bucket: "ingestion",
      });
    } catch (error) {
      failed += 1;
      log.error(
        { importId, sourceId: book.sourceId, error },
        "Failed to import a book",
      );
      captureServerException(error, userId, {
        task: "import-literal-books",
        importId,
      });
    }
  }

  await db.itemImport.update({
    where: { id: importId },
    data: {
      importedCount: { increment: imported },
      skippedCount: { increment: skipped },
      failedCount: { increment: failed },
    },
  });

  // Complete once every book across all chunks is accounted for. Raw SQL because
  // the check compares columns to `total_count`; conditional + idempotent.
  const completedNow = await db.$executeRaw`
    UPDATE item_imports
    SET status = 'completed', completed_at = now()
    WHERE id = ${importId}::uuid
      AND status = 'importing'
      AND imported_count + skipped_count + failed_count >= total_count
  `;
  const completed = completedNow > 0;

  if (completed) {
    const final = await db.itemImport.findUnique({
      where: { id: importId },
      select: {
        source: true,
        totalCount: true,
        importedCount: true,
        skippedCount: true,
        failedCount: true,
      },
    });
    if (final) {
      getPostHogClient()?.capture({
        distinctId: userId,
        event: "book_import_completed",
        properties: {
          source: final.source,
          total: final.totalCount,
          imported: final.importedCount,
          skipped: final.skippedCount,
          failed: final.failedCount,
        },
      });
    }
  }

  return { imported, skipped, failed, completed };
}
