"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { getRevealDelay } from "@/lib/grid-reveal";

type GridItemRevealProps = {
  /** Position of the item within the full grid list, used to stagger the reveal */
  index: number;
  children: ReactNode;
};

/**
 * Wraps a grid item so it fades and swings into place on mount instead of the
 * whole grid appearing at once. The subtle rotate gives the reveal a little
 * character. Honors `prefers-reduced-motion` by rendering statically.
 *
 * Only animates on mount, so appended (infinite-scroll) items reveal while
 * existing ones stay put.
 */
export function GridItemReveal({ index, children }: GridItemRevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 12, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{
        delay: getRevealDelay(index),
        type: "spring",
        stiffness: 260,
        damping: 24,
      }}
    >
      {children}
    </motion.div>
  );
}
