/**
 * Which theme a favicon disappears in. Many favicons are a single ink on a
 * transparent background, drawn for light browser tabs: dark ink vanishes on
 * our dark cards (and the odd white logo on light ones). Those get a backdrop
 * chip in the theme they vanish in; everything else renders bare.
 *
 * - `"dark"`: dark ink — needs a backdrop in dark mode
 * - `"light"`: light ink — needs a backdrop in light mode
 *
 * No tone (null) means it reads on both cards: mid-tone ink, or an icon with
 * its own opaque tile.
 */
export type FaviconTone = "dark" | "light";

/**
 * Backdrop for a favicon wrapper carrying `data-tone={tone}`. `bg-foreground`
 * is the inverse of the card in each theme, so the chip only lights up where
 * the ink would vanish, and switches with the theme in CSS alone.
 */
export const FAVICON_BACKDROP_CLASS =
  "data-[tone=dark]:dark:bg-foreground data-[tone=light]:not-dark:bg-foreground";

// Relative luminance of `--card` in each theme: white, and oklch(0.205 0 0)
// (an achromatic oklch L is linear luminance cubed)
const CARD_LUMINANCE = { light: 1, dark: 0.205 ** 3 };

// WCAG's minimum for non-text graphics
const MIN_CONTRAST = 3;
// Ink coverage above this means the icon brings its own tile (a filled square
// or circle), which reads on any background
const OWN_TILE_COVERAGE = 0.6;
// Below this share of readable ink, the icon vanishes on that card
const MIN_READABLE_SHARE = 0.5;

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Classify a favicon from its RGBA pixels (unpremultiplied, as
 * `getImageData` returns them). Each pixel's ink is weighted by its alpha, so
 * anti-aliased edges count for less than solid strokes.
 */
export function faviconTone(rgba: ArrayLike<number>): FaviconTone | null {
  const pixels = rgba.length / 4;
  let ink = 0;
  let readableOnLight = 0;
  let readableOnDark = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    if (alpha === 0) continue;
    const luminance =
      0.2126 * channelToLinear(rgba[i]) +
      0.7152 * channelToLinear(rgba[i + 1]) +
      0.0722 * channelToLinear(rgba[i + 2]);
    ink += alpha;
    if (contrast(luminance, CARD_LUMINANCE.light) >= MIN_CONTRAST) {
      readableOnLight += alpha;
    }
    if (contrast(luminance, CARD_LUMINANCE.dark) >= MIN_CONTRAST) {
      readableOnDark += alpha;
    }
  }
  if (ink === 0 || ink / pixels >= OWN_TILE_COVERAGE) return null;

  const vanishesOnLight = readableOnLight / ink < MIN_READABLE_SHARE;
  const vanishesOnDark = readableOnDark / ink < MIN_READABLE_SHARE;
  if (vanishesOnDark && !vanishesOnLight) return "dark";
  if (vanishesOnLight && !vanishesOnDark) return "light";
  return null;
}

// Favicons are tiny; a 32px sample keeps thin strokes while staying cheap
const SAMPLE_PX = 32;
const toneCache = new Map<string, Promise<FaviconTone | null>>();

/**
 * Load `src` and classify it, cached per URL. Resolves null when the pixels
 * can't be read (load error, no canvas, a cross-origin image tainting it):
 * the favicon then just renders bare, as before.
 */
export function loadFaviconTone(src: string): Promise<FaviconTone | null> {
  const cached = toneCache.get(src);
  if (cached !== undefined) return cached;
  const tone = new Promise<FaviconTone | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_PX;
        canvas.height = SAMPLE_PX;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, SAMPLE_PX, SAMPLE_PX);
        resolve(
          faviconTone(context.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX).data),
        );
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => {
      // Don't pin a transient failure; the next mount retries
      toneCache.delete(src);
      resolve(null);
    };
    image.src = src;
  });
  toneCache.set(src, tone);
  return tone;
}
