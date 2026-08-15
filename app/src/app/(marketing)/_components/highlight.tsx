import type { ReactNode } from "react";

/**
 * The pale rounded highlight used on key words in the marketing headings
 * (hero "yours.", gallery "your"). Padding/radius are em-based so the box keeps
 * the same proportions across heading sizes.
 */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[0.13em] bg-foreground/[0.07] px-[0.13em] py-[0.03em]">
      {children}
    </span>
  );
}
