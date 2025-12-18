import { Badge } from "@/components/ui/badge";
import type { RoomFilters } from "@/lib/rooms";

type FilterBadgesProps = {
  filters: RoomFilters;
  /** When true, limits badges shown and uses compact format for lists */
  compact?: boolean;
  /** Additional className for badges */
  badgeClassName?: string;
};

/**
 * Render filter badges for a room's filters.
 * Use compact mode for room lists, full mode for room detail views.
 */
export function FilterBadges({
  filters,
  compact = false,
  badgeClassName,
}: FilterBadgesProps) {
  if (compact) {
    return <CompactFilterBadges filters={filters} className={badgeClassName} />;
  }
  return <FullFilterBadges filters={filters} className={badgeClassName} />;
}

function FullFilterBadges({
  filters,
  className,
}: {
  filters: RoomFilters;
  className?: string;
}) {
  const badges: React.ReactNode[] = [];
  let key = 0;

  if (filters.type?.length) {
    for (const f of filters.type) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}type:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.tag?.length) {
    for (const f of filters.tag) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}#{f.value}
        </Badge>,
      );
    }
  }

  if (filters.object?.length) {
    for (const f of filters.object) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}object:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.color?.length) {
    for (const f of filters.color) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}color:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.source?.length) {
    for (const f of filters.source) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}source:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.location?.length) {
    for (const f of filters.location) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}location:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.dateAfter) {
    badges.push(
      <Badge key={key++} variant="outline" className={className}>
        after:{filters.dateAfter}
      </Badge>,
    );
  }

  if (filters.dateBefore) {
    badges.push(
      <Badge key={key++} variant="outline" className={className}>
        before:{filters.dateBefore}
      </Badge>,
    );
  }

  return <>{badges}</>;
}

function CompactFilterBadges({
  filters,
  className = "text-xs",
}: {
  filters: RoomFilters;
  className?: string;
}) {
  const badges: React.ReactNode[] = [];
  let key = 0;

  if (filters.type?.length) {
    for (const f of filters.type.slice(0, 2)) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}type:{f.value}
        </Badge>,
      );
    }
    if (filters.type.length > 2) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          +{filters.type.length - 2}
        </Badge>,
      );
    }
  }

  if (filters.tag?.length) {
    for (const f of filters.tag.slice(0, 2)) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}#{f.value}
        </Badge>,
      );
    }
    if (filters.tag.length > 2) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          +{filters.tag.length - 2}
        </Badge>,
      );
    }
  }

  if (filters.source?.length) {
    for (const f of filters.source.slice(0, 2)) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          {f.negated ? "!" : ""}source:{f.value}
        </Badge>,
      );
    }
    if (filters.source.length > 2) {
      badges.push(
        <Badge key={key++} variant="outline" className={className}>
          +{filters.source.length - 2}
        </Badge>,
      );
    }
  }

  if (filters.location?.length) {
    badges.push(
      <Badge key={key++} variant="outline" className={className}>
        {filters.location.length} location
        {filters.location.length > 1 ? "s" : ""}
      </Badge>,
    );
  }

  if (filters.dateAfter || filters.dateBefore) {
    badges.push(
      <Badge key={key++} variant="outline" className={className}>
        date filter
      </Badge>,
    );
  }

  // Limit total badges shown
  if (badges.length > 4) {
    const remaining = badges.length - 3;
    return (
      <>
        {badges.slice(0, 3)}
        <Badge key="more" variant="outline" className={className}>
          +{remaining} more
        </Badge>
      </>
    );
  }

  return <>{badges}</>;
}
