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
    const result = await importBookChunk({
      userId,
      importId,
      books: payload.books.map(hydrateBook),
      supabase: supabaseServiceClient(),
    });
    logger.log("Imported book chunk", { importId, ...result });
    return { success: true, importId, ...result };
  },
  // The chunk never got tallied (its tally is one statement, the last step),
  // so count its books as failed: the import still completes once its other
  // chunks land, rather than turning `failed` while they keep importing. If
  // this tally fails too, the stranded-imports sweep fails the import.
  onFailure: async ({ payload, error }) => {
    const { userId, importId } = payload;
    captureServerException(error, userId, {
      task: "import-literal-books",
      importId,
    });
    await tallyImportChunk({
      userId,
      importId,
      tally: { imported: 0, skipped: 0, failed: payload.books.length },
    });
  },
});
