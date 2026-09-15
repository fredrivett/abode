import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

// radial glow painted only on the 1px border (mask excludes the interior).
// Driven by --foreground so it reads in both themes (near-white on dark tiles,
// near-black on light ones) rather than a hardcoded white that vanishes in
// light mode.
const borderGlow: CSSProperties = {
  background:
    "radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklch, var(--foreground) 45%, transparent), transparent 60%)",
  padding: 1,
  WebkitMask:
    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  maskComposite: "exclude",
};

// soft highlight across the card surface, behind the content
const surfaceGlow: CSSProperties = {
  background:
    "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklch, var(--foreground) 6%, transparent), transparent 60%)",
};

/**
 * A bento tile lit by a cursor-following spotlight. Pure CSS: the overlays read
 * the --mx/--my vars set by the parent SpotlightGrid and fade in only while the
 * grid is hovered. `className` styles the tile (bg, padding, span); the content
 * sits above the glow via `contentClassName`.
 */
export function SpotlightCard({
  className,
  contentClassName,
  children,
}: {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-spotlight
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/60",
        className,
      )}
    >
      <span
        aria-hidden
        style={surfaceGlow}
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
      />
      <span
        aria-hidden
        style={borderGlow}
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
      />
      <div
        className={cn("relative z-10 flex h-full flex-col", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
