"use client";

import type { ArticleHighlight } from "@prisma/client";
import { Highlighter, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    return null;
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="highlights" className="border-b-0">
        <AccordionTrigger className="py-0 hover:no-underline cursor-pointer">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Highlights ({highlights.length})
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {highlights.length === 0 ? (
            <Card className="mt-2 py-4">
              <CardContent className="text-center">
                <Highlighter className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No highlights yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Select text to create a highlight
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 pt-2">
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
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Truncate text for display
  const displayText =
    highlight.text.length > 100
      ? `${highlight.text.slice(0, 100)}...`
      : highlight.text;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <button
      type="button"
      className="group w-full text-left p-3 rounded-md border border-border hover:border-yellow-400/50 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 transition-colors cursor-pointer"
      onClick={onClick}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <blockquote className="text-sm border-l-2 border-yellow-400 pl-2 italic text-foreground/80 flex-1">
          "{displayText}"
        </blockquote>

        <Button
          variant="ghost"
          size={confirmDelete ? "sm" : "icon"}
          className={
            confirmDelete
              ? "gap-1 text-destructive hover:text-destructive shrink-0"
              : "size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          }
          onClick={handleDeleteClick}
          disabled={isDeleting}
        >
          <Trash2 className="size-3.5" />
          {confirmDelete && "Confirm?"}
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
