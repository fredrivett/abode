import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import { IMPORT_CHUNK_MAX_DURATION_S } from "../src/lib/imports/constants";
import {
  importBookChunk,
  tallyImportChunk,
} from "../src/lib/imports/import-book-chunk";
import {
  hydrateBook,
  type SerializedNormalizedBook,
} from "../src/lib/imports/payload";
import { captureServerException } from "../src/lib/posthog-server";

function supabaseServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase config for import-literal-books");
  }
  return createClient(url, key);
}

type ImportLiteralBooksPayload = {
  userId: string;
  importId: string;
  books: SerializedNormalizedBook[];
};

/**
 * Write one chunk of an already-fetched Literal library. The route does the
 * credentialed fetch, so no token ever reaches this payload — it carries only
 * book metadata. Thin wrapper around {@link importBookChunk} (which holds the
 * testable orchestration: write + enqueue enrichment + tally + completion).
 *
 * No auto-retry: a re-run would re-process the chunk, and books without an ISBN
 * can't be deduped. Per-book failures are tallied inside the chunk, not thrown.
 */
export const importLiteralBooksTask = task({
  id: "import-literal-books",
  retry: { maxAttempts: 1 },
  maxDuration: IMPORT_CHUNK_MAX_DURATION_S,
  run: async (payload: ImportLiteralBooksPayload) => {
    const { userId, importId } = payload;
    let chunk: Pick<
      Parameters<typeof importBookChunk>[0],
      "books" | "supabase"
    >;
    try {
      chunk = {
        books: payload.books.map(hydrateBook),
        supabase: supabaseServiceClient(),
      };
    } catch (error) {
      // Nothing written yet, so every book in the chunk failed: tally them so
      // the import still completes once its other chunks land, rather than
      // turning `failed` while they keep importing
      await tallyImportChunk({
        userId,
        importId,
        tally: { imported: 0, skipped: 0, failed: payload.books.length },
      }).catch((tallyError) => {
        logger.error("Couldn't tally a failed chunk", { importId, tallyError });
        captureServerException(tallyError, userId, {
          task: "import-literal-books",
          importId,
        });
      });
      throw error;
    }
    // Past this point a throw is the chunk's own tally failing (per-book
    // errors are tallied, not thrown). Its books may be written and the tally
    // may even have committed, so it isn't retallied here: if the import
    // can't complete, the stranded-imports sweep fails it.
    const result = await importBookChunk({ userId, importId, ...chunk });
    logger.log("Imported book chunk", { importId, ...result });
    return { success: true, importId, ...result };
  },
  onFailure: async ({ payload, error }) => {
    captureServerException(error, payload.userId, {
      task: "import-literal-books",
      importId: payload.importId,
    });
  },
});
