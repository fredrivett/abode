import { Twitter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { X_URL } from "@/lib/social";

type XLinkProps = {
  className?: string;
};

export function XLink({ className }: XLinkProps) {
  return (
    <Button asChild variant="ghost-subtle" size="icon" className={className}>
      <a href={X_URL} target="_blank" rel="noreferrer" aria-label="Abode on X">
        <Twitter className="size-4" aria-hidden />
      </a>
    </Button>
  );
}
