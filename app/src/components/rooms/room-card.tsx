import type { RoomType } from "@prisma/client";
import { Hand, Sparkles } from "lucide-react";
import Link from "next/link";
import { FilterBadges } from "@/components/rooms/filter-badges";
import { Badge } from "@/components/ui/badge";
import type { Filter } from "@/lib/search/types";

type RoomCardProps = {
  href: string;
  name: string;
  emoji: string | null;
  itemCount: number;
  type: RoomType;
  /** Show a "Public" badge — the owner dashboard mixes public and private rooms */
  showPublicBadge?: boolean;
  /** Smart-room filters; rendered as a compact preview when present */
  filters?: Filter[] | null;
};

/**
 * A room tile: emoji + name, item count, and a Static/Dynamic indicator.
 *
 * Shared by the owner's dashboard and the public profile page. The dashboard
 * opts into the visibility badge and filter preview; the profile page omits
 * both (its rooms are all public, so a "Public" badge on every card is noise).
 */
export function RoomCard({
  href,
  name,
  emoji,
  itemCount,
  type,
  showPublicBadge = false,
  filters,
}: RoomCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium font-serif text-lg leading-none">
          {emoji && <span aria-hidden>{emoji}</span>}
          {name}
        </h3>
        {showPublicBadge && (
          <Badge variant="secondary" className="text-xs">
            Public
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-muted-foreground text-sm">
        <span>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        <span>·</span>
        {type === "smart" ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3" />
            Dynamic
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Hand className="size-3" />
            Static
          </span>
        )}
      </div>
      {type === "smart" && filters && (
        <div className="mt-3 flex flex-wrap gap-1">
          <FilterBadges filters={filters} compact />
        </div>
      )}
    </Link>
  );
}
