import type { enrichItemTask } from "@app/trigger/enrich-item";
import type { SupabaseClient } from "@supabase/supabase-js";
import { truncateToTokenLimit } from "@/lib/ai/generate-tags-from-content";
import db from "@/lib/db";
import type { NormalizedBook } from "@/lib/imports/types";
import { writeImportedBook } from "@/lib/imports/write-imported-book";
import { enqueueBackgroundProcessing } from "@/lib/items/enqueue-background-processing";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { ensureBookRooms } from "@/lib/rooms/auto-book-rooms";

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
 * atomically fold this chunk's tally onto the shared row ({@link tallyImportChunk}).
 * Chunks run concurrently (one Trigger run each); the chunk that accounts for the
 * final book flips `status` to `completed` and reports the funnel completion.
 * Per-book failures are tallied, never thrown, so one bad book can't abort the
 * chunk.
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

  // Materialize the user's book shelves once per chunk (idempotent) now that
  // they own books. Once-per-chunk, not per-book, keeps it cheap.
  if (imported > 0) {
    await ensureBookRooms(userId);
  }

  const completed = await tallyImportChunk({
    userId,
    importId,
    tally: { imported, skipped, failed },
  });
  return { imported, skipped, failed, completed };
}

type ChunkTally = { imported: number; skipped: number; failed: number };

/**
 * Fold one chunk's tally onto its import and complete the import once every
 * book across all chunks is accounted for, reporting the funnel completion.
 * One statement, so a chunk is either fully tallied or not at all (a crashed
 * chunk can then be tallied as failed without counting twice). The row is
 * locked before `completes` is worked out, so concurrent chunks queue and only
 * the one that accounts for the final book completes the import. Returns
 * whether this call completed it.
 */
export async function tallyImportChunk({
  userId,
  importId,
  tally,
}: {
  userId: string;
  importId: string;
  tally: ChunkTally;
}): Promise<boolean> {
  const { imported, skipped, failed } = tally;
  const added = imported + skipped + failed;
  const [row] = await db.$queryRaw<
    {
      completes: boolean;
      source: string;
      totalCount: number;
      importedCount: number;
      skippedCount: number;
      failedCount: number;
    }[]
  >`
    WITH prev AS (
      SELECT id,
        status = 'importing'
          AND imported_count + skipped_count + failed_count + ${added} >= total_count
          AS completes
      FROM item_imports WHERE id = ${importId}::uuid
      FOR UPDATE
    )
    UPDATE item_imports AS i
    SET imported_count = i.imported_count + ${imported},
        skipped_count = i.skipped_count + ${skipped},
        failed_count = i.failed_count + ${failed},
        status = CASE WHEN prev.completes THEN 'completed'::"ImportStatus" ELSE i.status END,
        completed_at = CASE WHEN prev.completes THEN now() ELSE i.completed_at END,
        updated_at = now()
    FROM prev
    WHERE i.id = prev.id
    RETURNING prev.completes, i.source::text AS source, i.total_count AS "totalCount",
      i.imported_count AS "importedCount", i.skipped_count AS "skippedCount",
      i.failed_count AS "failedCount"
  `;
  if (!row?.completes) return false;

  getPostHogClient()?.capture({
    distinctId: userId,
    event: "book_import_completed",
    properties: {
      source: row.source,
      total: row.totalCount,
      imported: row.importedCount,
      skipped: row.skippedCount,
      failed: row.failedCount,
    },
  });
  return true;
}
