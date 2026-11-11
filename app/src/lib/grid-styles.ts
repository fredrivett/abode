import type { CSSProperties } from "react";

/**
 * Base style for grid item cards.
 * Includes font scaling (for cards with text) and border radius.
 * Use `em` units for dimensions that should scale (font sizes, padding, gaps, etc.)
 *
 * Example:
 * ```tsx
 * <div style={gridCardStyle}>
 *   <p style={{ fontSize: '0.875em' }}>Scales with density</p>
 * </div>
 * ```
 */
export const gridCardStyle: CSSProperties = {
  fontSize: "calc(var(--grid-font-scale, 1) * 1rem)",
  borderRadius: "var(--grid-border-radius, 8px)",
  // Browsers' default (`auto`) differs on breaking before small kana and
  // other Japanese non-starters: Chrome does, WebKit doesn't. Pinning one rule
  // keeps a card's lines the same everywhere, which the text-card height
  // estimates (`wrapLines`) rely on
  lineBreak: "strict",
};

/**
 * {@link gridCardStyle} for the cards whose height is estimated from their
 * text (notes, tweets, articles). A word wider than the line (a long URL or
 * word) breaks to fit instead of overflowing, so it wraps by width as
 * `wrapLines` counts it rather than being clipped at the card edge
 */
export const textCardStyle: CSSProperties = {
  ...gridCardStyle,
  overflowWrap: "anywhere",
};
