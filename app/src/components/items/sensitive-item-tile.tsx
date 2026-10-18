"use client";

import { ShieldAlert } from "lucide-react";
import { gridCardStyle } from "@/lib/grid-styles";
import { cn } from "@/lib/utils";

type SensitiveItemTileProps = {
  /** Tiny LQIP of the cover — blurred further so only its colours show. */
  blurDataUrl: string | null;
  onOpen: () => void;
  className?: string;
};

/**
 * Grid stand-in for a sensitive item: a heavy blur of its placeholder colours
 * and a label, with no title or content. Opening it asks for the password.
 */
export function SensitiveItemTile({
  blurDataUrl,
  onOpen,
  className,
}: SensitiveItemTileProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Sensitive item — enter your password to open"
      style={gridCardStyle}
      className={cn(
        "relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden bg-muted",
        className,
      )}
    >
      {blurDataUrl && (
        <span
          aria-hidden="true"
          className="absolute inset-0 scale-125 bg-center bg-cover blur-2xl"
          style={{ backgroundImage: `url("${blurDataUrl}")` }}
        />
      )}
      <span className="relative flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 font-medium text-white text-xs backdrop-blur-sm">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        Sensitive
      </span>
    </button>
  );
}
