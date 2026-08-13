"use client";

import type { ProcessingStatus } from "@prisma/client";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { IsLoading } from "@/components/ui/is-loading";
import { gridCardStyle } from "@/lib/grid-styles";
import { cn } from "@/lib/utils";

/**
 * Status scrim drawn over a grid card while its item is still being enriched:
 * an "Analyzing" spinner pill while `processing`, a red "Failed" badge on
 * `failed`. Fades out once `completed` so the card settles rather than popping.
 * The scrim is pointer-transparent so the card underneath stays clickable (only
 * the pill captures pointer events, to keep its own cursor).
 */
export function ProcessingOverlay({ status }: { status: ProcessingStatus }) {
  const isProcessing = status === "processing";
  const isFailed = status === "failed";

  return (
    <AnimatePresence>
      {(isProcessing || isFailed) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-end justify-start p-2",
            isProcessing &&
              "bg-gradient-to-t from-black/60 via-transparent to-transparent",
            isFailed &&
              "bg-gradient-to-t from-red-900/70 via-transparent to-transparent",
          )}
          style={gridCardStyle}
        >
          {/* No backdrop-blur: a backdrop-filter mis-composites (hazes the tile,
              pill flattens) while an ancestor's opacity animates, then pops once
              the fade settles. The pill sits over the scrim, so it stays legible
              with a plain translucent fill. */}
          <div
            className={cn(
              "pointer-events-auto flex cursor-default items-center gap-1.5 rounded-full px-2 py-1 font-medium text-xs",
              isProcessing && "bg-black/40 text-white",
              isFailed && "bg-red-900/60 text-red-50",
            )}
          >
            {isProcessing ? (
              <IsLoading
                label="Analyzing"
                iconClassName="size-3"
                className="gap-1"
              />
            ) : (
              <>
                <AlertCircle className="size-3" />
                <span>Failed</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
