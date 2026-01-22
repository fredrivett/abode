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
  /**
   * Whether the current user can edit (delete) highlights.
   * Defaults to true for backwards compatibility.
   */
  canEdit?: boolean;
};

export function HighlightsPanel({
  itemId,
  onHighlightClick,
  canEdit = true,
}: Props) {
  const { data: highlights = [], isLoading } = useItemHighlights(itemId);
  const deleteHighlight = useDeleteHighlight(itemId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return null;
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="highlights" className="border-b-0">
        <AccordionTrigger className="cursor-pointer py-0 hover:no-underline">
          <span className="font-semibold text-gray-700 text-sm dark:text-gray-300">
            Highlights ({highlights.length})
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {highlights.length === 0 ? (
            <Card className="mt-2 py-4">
              <CardContent className="text-center">
                <Highlighter className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  No highlights yet
                </p>
                <p className="mt-1 text-muted-foreground/70 text-xs">
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
                  canEdit={canEdit}
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
  canEdit,
}: {
  highlight: HighlightData;
  onClick?: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  canEdit: boolean;
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
      className="group w-full cursor-pointer rounded-md border border-border p-3 text-left transition-colors hover:border-yellow-400/50 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10"
      onClick={onClick}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <blockquote className="flex-1 border-yellow-400 border-l-2 pl-2 text-foreground/80 text-sm italic">
          "{displayText}"
        </blockquote>

        {canEdit && (
          <Button
            variant="ghost"
            size={confirmDelete ? "sm" : "icon"}
            className={
              confirmDelete
                ? "shrink-0 gap-1 text-destructive hover:text-destructive"
                : "size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            }
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            <Trash2 className="size-3.5" />
            {confirmDelete && "Confirm?"}
          </Button>
        )}
      </div>

      {highlight.note && (
        <p className="mt-2 pl-2 text-muted-foreground text-xs">
          {highlight.note}
        </p>
      )}
    </button>
  );
}
