"use client";

import type { ArticleHighlight } from "@prisma/client";
import { Highlighter } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  useCreateHighlight,
  useItemHighlights,
} from "@/lib/highlights/use-highlights";
import { HighlightedMarkdown } from "./highlighted-markdown";

type HighlightData = Pick<
  ArticleHighlight,
  "id" | "startOffset" | "endOffset" | "text" | "note"
>;

type Props = {
  itemId: string;
  content: string;
  className?: string;
  onHighlightClick?: (highlight: HighlightData) => void;
};

type SelectionState = {
  text: string;
  startOffset: number;
  endOffset: number;
  anchorRect: DOMRect;
} | null;

/**
 * Article content with highlighting capabilities.
 * Handles text selection and creates highlights via the API.
 */
export function HighlightableArticle({
  itemId,
  content,
  className,
  onHighlightClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState>(null);

  const { data: highlights = [] } = useItemHighlights(itemId);
  const createHighlight = useCreateHighlight(itemId);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();

    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelection(null);
      return;
    }

    const selectedText = sel.toString().trim();

    if (!selectedText || selectedText.length < 3) {
      setSelection(null);
      return;
    }

    // Find the offset in the original content
    // We use a simple text matching approach for MVP
    const startOffset = content.indexOf(selectedText);

    if (startOffset === -1) {
      // Text not found - might be across markdown elements or duplicates
      // For now, just skip
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelection({
      text: selectedText,
      startOffset,
      endOffset: startOffset + selectedText.length,
      anchorRect: rect,
    });
  }, [content]);

  const handleCreateHighlight = useCallback(async () => {
    if (!selection) return;

    try {
      await createHighlight.mutateAsync({
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        text: selection.text,
      });

      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelection(null);

      toast.success("Highlight created");
    } catch {
      toast.error("Failed to create highlight");
    }
  }, [selection, createHighlight]);

  const handleClosePopover = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: We need mouseup on this container for text selection
    <div ref={containerRef} onMouseUp={handleMouseUp}>
      <HighlightedMarkdown
        content={content}
        highlights={highlights}
        className={className}
        onHighlightClick={onHighlightClick}
      />

      {selection && (
        <Popover open onOpenChange={(open) => !open && handleClosePopover()}>
          <PopoverAnchor
            style={{
              position: "fixed",
              left: selection.anchorRect.left + selection.anchorRect.width / 2,
              top: selection.anchorRect.top - 8,
              width: 0,
              height: 0,
            }}
          />
          <PopoverContent
            side="top"
            sideOffset={8}
            className="w-auto p-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleCreateHighlight}
              disabled={createHighlight.isPending}
            >
              <Highlighter className="size-4" />
              Highlight
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
