import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

type ViewOnButtonProps = {
  /** External URL to open in a new tab */
  href: string;
  /** Destination shown after "View on " (e.g. "X", "Instagram", a domain) */
  label: string;
  className?: string;
};

/**
 * Outline button linking to an item's original source, used across the detail
 * views (Twitter, Instagram, book, product, video). Opens in a new tab with the
 * standard external-link icon.
 */
export function ViewOnButton({ href, label, className }: ViewOnButtonProps) {
  return (
    <Button variant="outline" size="sm" asChild className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" />
        View on {label}
      </a>
    </Button>
  );
}
