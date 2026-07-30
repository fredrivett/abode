/**
 * One-time backfill: generate LQIP blur placeholders for existing images that
 * predate the feature. For each item_image_details row missing a blur, download
 * the source image and regenerate just the tiny placeholder (no vision re-run,
 * so no AI cost) and store it.
 *
 * Scope: single-image kinds and cover-bearing kinds whose source resolves from
 * the item row — image (file_key) and article/webpage/product/book
 * (cover_file_key). Tweets render via TwitterCard and aren't covered here; their
 * per-media blur backfill + rendering is a separate follow-up.
 *
 * Trigger manually from the Trigger.dev dashboard.
 */

import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { generateBlurDataUrl } from "@/lib/image-analysis/blur-placeholder";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url)
    throw new Error("Missing SUPABASE_URL for backfill-blur-placeholders");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

export const backfillBlurPlaceholdersTask = task({
  id: "backfill-blur-placeholders",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async () => {
    const { url, key } = getSupabaseConfig();
    const supabase = createClient(url, key);

    // Rows lacking a blur whose source image is resolvable from the item:
    // image → file_key; article/webpage/product/book → cover_file_key.
    const rows = await db.$queryRaw<
      Array<{ item_id: string; file_key: string | null }>
    >`
      SELECT d.item_id,
             COALESCE(i.file_key, i.cover_file_key) AS file_key
      FROM item_image_details d
      JOIN items i ON i.id = d.item_id
      WHERE d.blur_data_url IS NULL
        AND COALESCE(i.file_key, i.cover_file_key) IS NOT NULL
    `;

    logger.info(`Found ${rows.length} image_details rows to backfill`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const fileKey = row.file_key;
      if (!fileKey) {
        skipped++;
        continue;
      }
      try {
        const { data, error } = await supabase.storage
          .from("items")
          .download(fileKey);
        if (error || !data) {
          logger.warn(`Download failed for ${row.item_id}`, { fileKey });
          skipped++;
          continue;
        }

        const buffer = Buffer.from(await data.arrayBuffer());
        const blurDataUrl = await generateBlurDataUrl(buffer);
        if (!blurDataUrl) {
          // Undecodable (e.g. HEIC) — leave null, card falls back to gradient
          skipped++;
          continue;
        }

        await db.itemImageDetails.update({
          where: { itemId: row.item_id },
          data: { blurDataUrl },
        });
        updated++;

        if (updated % 100 === 0) {
          logger.info(`Progress: ${updated}/${rows.length} updated`);
        }
      } catch (error) {
        logger.error(`Failed to backfill item ${row.item_id}`, { error });
        skipped++;
      }
    }

    logger.info(
      `Blur backfill complete: ${updated} updated, ${skipped} skipped, ${rows.length} total`,
    );

    return { total: rows.length, updated, skipped };
  },
});
