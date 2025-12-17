/**
 * One-time backfill task to add color names to existing item_image_details.
 *
 * Run this once after deploying the color name feature to update existing data.
 * Can be triggered manually from the Trigger.dev dashboard.
 */

import { task } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { getNearestColorName } from "@/lib/search/color-utils";

type OldColorFormat = { hex: string; score: number };
type NewColorFormat = { hex: string; name: string; score: number };

export const backfillColorNamesTask = task({
  id: "backfill-color-names",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async () => {
    // Find all item_image_details with colors that don't have names
    // We check if the first color element lacks a 'name' field
    // itemId is the primary key (maps to item_id in the database)
    const itemsToUpdate = await db.$queryRaw<
      Array<{ item_id: string; colors: unknown }>
    >`
      SELECT item_id, colors
      FROM item_image_details
      WHERE colors IS NOT NULL
        AND jsonb_array_length(colors) > 0
        AND NOT (colors->0 ? 'name')
    `;

    console.log(`Found ${itemsToUpdate.length} items to backfill`);

    let updated = 0;
    let skipped = 0;

    for (const item of itemsToUpdate) {
      try {
        const oldColors = item.colors as OldColorFormat[];

        // Convert to new format with color names
        const newColors: NewColorFormat[] = oldColors
          .map((color) => {
            const name = getNearestColorName(color.hex);
            return {
              hex: color.hex,
              name: name || "unknown",
              score: color.score,
            };
          })
          .filter((c) => c.name !== "unknown");

        // Update the record (itemId is the primary key)
        await db.itemImageDetails.update({
          where: { itemId: item.item_id },
          data: { colors: newColors },
        });

        updated++;

        // Log progress every 100 items
        if (updated % 100 === 0) {
          console.log(`Progress: ${updated}/${itemsToUpdate.length} updated`);
        }
      } catch (error) {
        console.error(`Failed to update item ${item.item_id}:`, error);
        skipped++;
      }
    }

    console.log(
      `Backfill complete: ${updated} updated, ${skipped} skipped, ${itemsToUpdate.length} total`,
    );

    return {
      total: itemsToUpdate.length,
      updated,
      skipped,
    };
  },
});
