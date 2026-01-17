/**
 * One-time backfill task to add LAB color values to existing item_image_details.
 *
 * LAB values are pre-computed from hex for efficient perceptual color matching
 * during search. Run this once after deploying the hex color search feature.
 * Can be triggered manually from the Trigger.dev dashboard.
 */

import { logger, task } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { hexToLab } from "@/lib/search/color-utils";

type ColorWithoutLab = {
  hex: string;
  name: string;
  score: number;
};

type ColorWithLab = ColorWithoutLab & {
  l: number;
  a: number;
  b: number;
};

export const backfillColorLabTask = task({
  id: "backfill-color-lab",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async () => {
    // Find all item_image_details with colors that don't have LAB values
    // We check if the first color element lacks an 'l' field
    const itemsToUpdate = await db.$queryRaw<
      Array<{ item_id: string; colors: unknown }>
    >`
      SELECT item_id, colors
      FROM item_image_details
      WHERE colors IS NOT NULL
        AND jsonb_array_length(colors) > 0
        AND NOT (colors->0 ? 'l')
    `;

    logger.info(`Found ${itemsToUpdate.length} items to backfill with LAB values`);

    let updated = 0;
    let skipped = 0;

    for (const item of itemsToUpdate) {
      try {
        const colors = item.colors as ColorWithoutLab[];

        // Add LAB values to each color
        const colorsWithLab: ColorWithLab[] = colors
          .map((color) => {
            const lab = hexToLab(color.hex);
            if (!lab) {
              // Skip colors with invalid hex (shouldn't happen but be safe)
              return null;
            }
            return {
              hex: color.hex,
              name: color.name,
              score: color.score,
              l: lab.l,
              a: lab.a,
              b: lab.b,
            };
          })
          .filter((c): c is ColorWithLab => c !== null);

        // Update the record
        await db.itemImageDetails.update({
          where: { itemId: item.item_id },
          data: { colors: colorsWithLab },
        });

        updated++;

        // Log progress every 100 items
        if (updated % 100 === 0) {
          logger.info(`Progress: ${updated}/${itemsToUpdate.length} updated`);
        }
      } catch (error) {
        logger.error(`Failed to update item ${item.item_id}:`, { error });
        skipped++;
      }
    }

    logger.info(
      `LAB backfill complete: ${updated} updated, ${skipped} skipped, ${itemsToUpdate.length} total`,
    );

    return {
      total: itemsToUpdate.length,
      updated,
      skipped,
    };
  },
});
