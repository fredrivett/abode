"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps the bento grid and, on pointer move, writes each card's cursor-relative
 * position into its --mx/--my CSS vars. The cards (SpotlightCard) read those to
 * paint a radial glow that tracks the mouse — one shared light source across
 * the grid, with zero animation-library deps. On touch / no-JS the cards render
 * as plain tiles (the glow simply never fades in).
 */
export function SpotlightGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cards =
      ref.current?.querySelectorAll<HTMLElement>("[data-spotlight]");
    if (!cards) return;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      card.style.setProperty("--my", `${e.clientY - rect.top}px`);
    }
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn("group/spot", className)}
    >
      {children}
    </div>
  );
}
