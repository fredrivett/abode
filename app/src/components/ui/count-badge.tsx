import { Badge } from "@/components/ui/badge";

type CountBadgeProps = {
  count: number;
  "aria-label"?: string;
};

/**
 * A small count badge positioned absolutely for use on navigation items.
 * Designed to overlay icons (e.g., notification counts, pending tasks).
 * Has pointer-events-none to allow clicks to pass through to the parent link/button.
 */
export function CountBadge({ count, "aria-label": ariaLabel }: CountBadgeProps) {
  return (
    <Badge
      variant="outline"
      aria-label={ariaLabel}
      className="pointer-events-none absolute top-0 right-0 h-4 min-w-4 rounded border-muted-foreground/20 bg-muted px-1 py-0 text-[10px] text-muted-foreground leading-none"
    >
      {count}
    </Badge>
  );
}
