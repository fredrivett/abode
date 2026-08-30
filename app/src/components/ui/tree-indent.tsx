import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type TreeIndentProps = {
  /** 0 = a top-level row (no indent); 1 = child; 2 = grandchild; … */
  depth: number;
  className?: string;
};

/**
 * Fixed-width indent gutters for one row of a tree. Each level is one gutter the
 * width of the connector icon, so nested rows line up and the connector sits in
 * the last gutter pointing at the row's content. Renders nothing at depth 0.
 *
 * Decorative — hidden from assistive tech; nesting is conveyed by row order and
 * labels, so the connector shouldn't add noise to a screen reader.
 */
export function TreeIndent({ depth, className }: TreeIndentProps) {
  if (depth <= 0) return null;
  return (
    <span
      className={cn("flex shrink-0 self-stretch", className)}
      aria-hidden="true"
    >
      {Array.from({ length: depth - 1 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count spacer gutters
        <span key={i} className="w-4 shrink-0" />
      ))}
      <span className="flex w-4 shrink-0 items-center justify-center text-muted-foreground">
        <CornerDownRight className="size-4" />
      </span>
    </span>
  );
}
