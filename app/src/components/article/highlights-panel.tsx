"use client";

import type { ArticleHighlight } from "@prisma/client";
import { Highlighter, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useDeleteHighlight,
  useItemHighlights,
} from "@/lib/highlights/use-highlights";

type HighlightData = Pick<
  ArticleHighlight,
  "id" | "startOffset" | "endOffset" | "text" | "note" | "createdAt"
>;

type Props = {
  itemId: string;
  onHighlightClick?: (highlight: HighlightData) => void;
};

export function HighlightsPanel({ itemId, onHighlightClick }: Props) {
  const { data: highlights = [], isLoading } = useItemHighlights(itemId);
  const deleteHighlight = useDeleteHighlight(itemId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading highlights...
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="p-4 text-center">
        <Highlighter className="size-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No highlights yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Select text to create a highlight
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground">
          Highlights ({highlights.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
          {highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              onClick={() => onHighlightClick?.(highlight)}
              onDelete={() => {
                setDeletingId(highlight.id);
                deleteHighlight.mutate(highlight.id, {
                  onSettled: () => setDeletingId(null),
                });
              }}
              isDeleting={deletingId === highlight.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  onClick,
  onDelete,
  isDeleting,
}: {
  highlight: HighlightData;
  onClick?: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  // Truncate text for display
  const displayText =
    highlight.text.length > 100
      ? `${highlight.text.slice(0, 100)}...`
      : highlight.text;

  return (
    <button
      type="button"
      className="group w-full text-left p-3 rounded-md border border-border hover:border-yellow-400/50 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <blockquote className="text-sm border-l-2 border-yellow-400 pl-2 italic text-foreground/80 flex-1">
          "{displayText}"
        </blockquote>

        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
        >
          <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {highlight.note && (
        <p className="text-xs text-muted-foreground mt-2 pl-2">
          {highlight.note}
        </p>
      )}
    </button>
  );
}
