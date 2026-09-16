import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import { importBookChunk } from "../src/lib/imports/import-book-chunk";
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
  maxDuration: 600,
  run: async (payload: ImportLiteralBooksPayload) => {
    const { userId, importId } = payload;
    try {
      const result = await importBookChunk({
        userId,
        importId,
        books: payload.books.map(hydrateBook),
        supabase: supabaseServiceClient(),
      });
      logger.log("Imported book chunk", { importId, ...result });
      return { success: true, importId, ...result };
    } catch (error) {
      logger.error("Import chunk failed", { importId, error });
      captureServerException(error, userId, {
        task: "import-literal-books",
        importId,
      });
      throw error;
    }
  },
});
