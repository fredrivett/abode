import { ARTICLE_ASPECT_BOUNDS } from "./article-card-layout";
import { NOTE_ASPECT_BOUNDS, TWEET_ASPECT_BOUNDS } from "./card-aspect";

/**
 * Whether a content-sized card fits the frame the grid reserved for it — the
 * one rule shared by the `Grid/CardFit` stories (fixtures, in CI) and the
 * debug-trace grid check (real items, in the app).
 *
 * Content-sized cards (notes, text tweets, coverless articles) mark their root
 * with {@link CARD_FIT_ATTR} so the grid check can find and re-measure them.
 */
export const CARD_FIT_ATTR = "data-card-fit";

export type CardFitKind = "note" | "tweet" | "article";

/** Each kind's tallest allowed frame (width/height): past it the fade truncates */
export const CARD_FIT_MIN_ASPECT: Record<CardFitKind, number> = {
  note: NOTE_ASPECT_BOUNDS.minAspect,
  tweet: TWEET_ASPECT_BOUNDS.minAspect,
  article: ARTICLE_ASPECT_BOUNDS.minAspect,
};

export function isCardFitKind(value: string | null): value is CardFitKind {
  return value !== null && value in CARD_FIT_MIN_ASPECT;
}

// Under the overflow fade's own 4px tolerance (`useIsOverflowing`), clipping
// only eats bottom padding: nothing a user sees
const CLIP_TOLERANCE_PX = 3;
// Slack under this (or this share of the frame) doesn't read as empty space
const MAX_SLACK_PX = 24;
const MAX_SLACK_RATIO = 0.12;

export type CardFitIssue = "clipped" | "empty-space";

/**
 * `frame` is the height the grid reserved, `natural` the height the card's
 * content needs (px). A frame at its kind's tallest allowed shape is meant to
 * clip, so that's only checked for empty space.
 */
export function cardFitIssue({
  kind,
  width,
  frame,
  natural,
}: {
  kind: CardFitKind;
  width: number;
  frame: number;
  natural: number;
}): CardFitIssue | null {
  const atTallest = width / frame <= CARD_FIT_MIN_ASPECT[kind] + 1e-3;
  if (natural > frame + CLIP_TOLERANCE_PX && !atTallest) return "clipped";
  if (frame - natural > Math.max(MAX_SLACK_PX, frame * MAX_SLACK_RATIO)) {
    return "empty-space";
  }
  return null;
}
