import { Play } from "lucide-react";
import type { ReactNode } from "react";
import {
  CARD_BADGE_ICON_EM,
  CARD_BADGE_OFFSET_EM,
  CARD_BADGE_PADDING_EM,
} from "@/lib/grid-styles";
import { cn } from "@/lib/utils";

/**
 * The overlays grid cards draw over their content, so every kind uses the same
 * surface, corners and em sizing (scaling with grid density):
 *   - `CardCornerBadge`, top right: what the item is (X, Instagram, YouTube) or
 *     where it stands (book reading status, article read/unread)
 *   - `CardTag`, bottom corners: a fact about the item (duration, GIF, price,
 *     page count)
 *   - `CardPlayIndicator`, centred: the media plays
 * The processing scrim (`ProcessingOverlay`) is a transient state on top of
 * these, not one of them.
 */
const SURFACE_CLASS = "bg-black/60 text-white backdrop-blur-sm";

const OFFSET = `${CARD_BADGE_OFFSET_EM}em`;

type CardCornerBadgeProps = {
  /** An svg icon; it's sized to the badge */
  icon: ReactNode;
  /**
   * Slides out to the left of the icon on hover. Always in the accessibility
   * tree, so a status badge still announces its state while collapsed
   */
  label?: string;
  className?: string;
};

export function CardCornerBadge({
  icon,
  label,
  className,
}: CardCornerBadgeProps) {
  const iconSize = `${CARD_BADGE_ICON_EM}em`;
  return (
    <div
      className={cn(
        "group/corner-badge absolute flex items-center rounded-full",
        SURFACE_CLASS,
        className,
      )}
      style={{
        top: OFFSET,
        right: OFFSET,
        padding: `${CARD_BADGE_PADDING_EM}em`,
      }}
    >
      {label && (
        // 0fr → 1fr grid track animates the label's intrinsic width
        <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover/corner-badge:grid-cols-[1fr] motion-reduce:transition-none">
          <span className="overflow-hidden">
            <span
              className="block whitespace-nowrap font-medium leading-none"
              style={{
                fontSize: "0.75em",
                paddingLeft: "0.35em",
                paddingRight: "0.4em",
              }}
            >
              {label}
            </span>
          </span>
        </span>
      )}
      <span
        className="flex shrink-0 [&_svg]:size-full"
        style={{ width: iconSize, height: iconSize }}
      >
        {icon}
      </span>
    </div>
  );
}

type CardTagProps = {
  corner: "bottom-left" | "bottom-right";
  /** Text, optionally led by an svg icon (sized to the text) */
  children: ReactNode;
  className?: string;
};

// Tag text size in card em. The tag's own em is this size, so its offset is
// scaled back up to sit the same distance in as the corner badge
const TAG_FONT_EM = 0.75;
const TAG_OFFSET = `${CARD_BADGE_OFFSET_EM / TAG_FONT_EM}em`;

export function CardTag({ corner, children, className }: CardTagProps) {
  return (
    <div
      className={cn(
        "absolute flex items-center rounded-[0.35em] font-medium leading-none [&_svg]:size-[1em] [&_svg]:shrink-0",
        SURFACE_CLASS,
        className,
      )}
      style={{
        fontSize: `${TAG_FONT_EM}em`,
        bottom: TAG_OFFSET,
        ...(corner === "bottom-left"
          ? { left: TAG_OFFSET }
          : { right: TAG_OFFSET }),
        padding: "0.35em 0.5em",
        gap: "0.3em",
      }}
    >
      {children}
    </div>
  );
}

/** Centred play button over a video or GIF still; grows with the card's hover */
export function CardPlayIndicator() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={cn(
          "rounded-full transition-transform group-hover:scale-110",
          SURFACE_CLASS,
        )}
        style={{ padding: "0.75em" }}
      >
        <Play
          className="fill-white text-white"
          style={{ width: "1.5em", height: "1.5em" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
