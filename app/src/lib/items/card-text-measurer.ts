/**
 * Real font measurement for the card aspect estimators, backed by a single
 * cached canvas 2D context. `measureText` uses the browser's actual font
 * engine, so emoji, CJK, ligatures, and wide caps are measured — not guessed.
 *
 * When there's no canvas (SSR, jsdom), it falls back to an average-advance
 * approximation so the estimator still returns a sane ratio; the client
 * refines it once mounted.
 */

import type {
  CardFontFamily,
  CardTextStyle,
  TextMeasurer,
} from "./card-aspect";

// Generic fallbacks; the real families (page font / Hedvig) are resolved from the
// DOM at runtime so measured widths match the rendered card.
const FALLBACK_STACK: Record<CardFontFamily, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "ui-serif, Georgia, Cambria, serif",
};

// Rough mean glyph advance as a fraction of font size, for the no-canvas path.
const FALLBACK_ADVANCE: Record<CardFontFamily, number> = {
  sans: 0.52,
  serif: 0.5,
};

let cachedContext: CanvasRenderingContext2D | null | undefined;

function getContext(): CanvasRenderingContext2D | null {
  if (cachedContext !== undefined) return cachedContext;
  try {
    cachedContext = document.createElement("canvas").getContext("2d") ?? null;
  } catch {
    cachedContext = null;
  }
  return cachedContext;
}

// Read the concrete font family card text renders in off the live DOM, by
// probing a hidden element styled like it: sans text inherits the page font,
// serif text uses the `font-serif` class. (Tailwind's `@theme inline` emits no
// `--font-*` variables to read, and canvas `ctx.font` can't resolve them.)
function readFamily(className: string, fallback: string): string {
  try {
    const probe = document.createElement("span");
    probe.className = className;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).fontFamily;
    probe.remove();
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

let cachedStack: Record<CardFontFamily, string> | undefined;

function fontStack(): Record<CardFontFamily, string> {
  if (cachedStack) return cachedStack;
  if (typeof document === "undefined") return FALLBACK_STACK;
  cachedStack = {
    sans: readFamily("", FALLBACK_STACK.sans),
    serif: readFamily("font-serif", FALLBACK_STACK.serif),
  };
  return cachedStack;
}

function fontFor({ px, weight = 400, family = "sans" }: CardTextStyle): string {
  return `${weight} ${px}px ${fontStack()[family]}`;
}

/**
 * Shared measurer used by the grid. Memoized per (text, font) since the grid
 * measures the same strings across re-renders and density changes.
 */
export const measureCardText: TextMeasurer = (text, style) => {
  const context = getContext();
  const family = style.family ?? "sans";
  if (!context) {
    return text.length * style.px * FALLBACK_ADVANCE[family];
  }
  const font = fontFor(style);
  const cacheKey = `${font} ${text}`;
  const cached = measureCache.get(cacheKey);
  if (cached !== undefined) return cached;

  context.font = font;
  const width = context.measureText(text).width;
  if (measureCache.size >= MAX_CACHE_ENTRIES) measureCache.clear();
  measureCache.set(cacheKey, width);
  return width;
};

const MAX_CACHE_ENTRIES = 4000;
const measureCache = new Map<string, number>();

// Text measured before its web font has loaded is measured in a fallback face
// (a card's serif title only requests Hedvig once it renders). Each time fonts
// finish loading, drop the cached widths and bump the epoch, so subscribers
// (`useCardFrame`) re-measure. Registered at import, before anything measures.
let fontEpoch = 0;
const fontListeners = new Set<() => void>();
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener("loadingdone", () => {
    measureCache.clear();
    fontEpoch++;
    for (const listener of fontListeners) listener();
  });
}

/** `useSyncExternalStore` source: changes whenever web fonts finish loading */
export function subscribeCardFonts(onChange: () => void): () => void {
  fontListeners.add(onChange);
  return () => fontListeners.delete(onChange);
}

export const getCardFontEpoch = () => fontEpoch;
