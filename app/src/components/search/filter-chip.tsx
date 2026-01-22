"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FILTER_TYPES,
  type Filter,
  getFilterColorClass,
  NONE_FILTER_VALUE,
  NOT_NONE_FILTER_VALUE,
} from "@/lib/search/types";
import { cn } from "@/lib/utils";

type FilterChipProps = {
  filter: Filter;
  onRemove?: (id: string) => void;
  className?: string;
};

export function FilterChip({ filter, onRemove, className }: FilterChipProps) {
  const meta = FILTER_TYPES[filter.type];
  const displayValue = getDisplayValue(filter);

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 py-0.75 font-normal text-sm",
        onRemove ? "pr-1" : "pr-2",
        getFilterColorClass(filter.type),
        filter.negated && "line-through decoration-destructive/50",
        className,
      )}
    >
      <span className="opacity-70">{meta.label}:</span>
      {filter.type === "color" && (
        <span
          className="size-3 rounded-sm border border-current/20"
          style={{ backgroundColor: filter.value }}
        />
      )}
      <span
        className={cn(
          "font-medium",
          (filter.value === NONE_FILTER_VALUE ||
            filter.value === NOT_NONE_FILTER_VALUE) &&
            "italic",
        )}
      >
        {displayValue}
      </span>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-4 rounded-full p-0 hover:bg-current/20"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(filter.id);
          }}
          aria-label={`Remove ${meta.label} filter`}
        >
          <X className="size-3" />
        </Button>
      )}
    </Badge>
  );
}

function getDisplayValue(filter: Filter): string {
  if (filter.type === "color") {
    // For colors, show the hex value (could enhance with color swatch later)
    return filter.value;
  }

  if (filter.type === "date") {
    const formatDate = (dateStr: string) => {
      try {
        return new Date(dateStr).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return dateStr;
      }
    };

    switch (filter.dateOperator) {
      case "after":
        return `after ${formatDate(filter.value)}`;
      case "before":
        return `before ${formatDate(filter.value)}`;
      case "between":
        return `${formatDate(filter.value)} – ${formatDate(filter.endDate || "")}`;
      default:
        return formatDate(filter.value);
    }
  }

  return filter.value;
}

type FilterChipsProps = {
  filters: Filter[];
  onRemove?: (id: string) => void;
  className?: string;
};

export function FilterChips({
  filters,
  onRemove,
  className,
}: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {filters.map((filter) => (
        <FilterChip key={filter.id} filter={filter} onRemove={onRemove} />
      ))}
    </div>
  );
}
