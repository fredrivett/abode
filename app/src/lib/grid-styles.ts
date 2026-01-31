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
};
