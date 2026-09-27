import { createPixels, type Pixels } from "./warp";

export const SCAN_FILTERS = ["bw", "grey", "original"] as const;
export type ScanFilter = (typeof SCAN_FILTERS)[number];

export const SCAN_FILTER_LABELS: Record<ScanFilter, string> = {
  bw: "B&W",
  grey: "Greyscale",
  original: "Colour",
};

/** Relative luminance (BT.709) per pixel, 0–255 */
function luminance(pixels: Pixels): Float32Array {
  const { data, width, height } = pixels;
  const out = new Float32Array(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return out;
}

/**
 * Estimates the paper brightness under each pixel — the lighting, without the
 * ink. Takes the max over coarse blocks (thin strokes vanish, paper remains),
 * smooths the block grid, then samples it bilinearly at full resolution.
 */
function estimateBackground({
  lum,
  width,
  height,
}: {
  lum: Float32Array;
  width: number;
  height: number;
}): Float32Array {
  const block = Math.max(4, Math.round(Math.max(width, height) / 60));
  const gw = Math.ceil(width / block);
  const gh = Math.ceil(height / block);

  const grid = new Float32Array(gw * gh);
  for (let y = 0; y < height; y++) {
    const gy = (y / block) | 0;
    for (let x = 0; x < width; x++) {
      const gi = gy * gw + ((x / block) | 0);
      const v = lum[y * width + x];
      if (v > grid[gi]) grid[gi] = v;
    }
  }

  // Box blur the grid so one bright speck or dark bold block doesn't show
  const radius = 2;
  const smooth = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = gy + dy;
        if (yy < 0 || yy >= gh) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = gx + dx;
          if (xx < 0 || xx >= gw) continue;
          sum += grid[yy * gw + xx];
          count++;
        }
      }
      smooth[gy * gw + gx] = sum / count;
    }
  }

  const background = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / block - 0.5));
    const y0 = fy | 0;
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / block - 0.5));
      const x0 = fx | 0;
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const top = smooth[y0 * gw + x0] * (1 - tx) + smooth[y0 * gw + x1] * tx;
      const bottom =
        smooth[y1 * gw + x0] * (1 - tx) + smooth[y1 * gw + x1] * tx;
      background[y * width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return background;
}

/**
 * Each pixel's brightness relative to the paper around it (0 = black ink,
 * ~1 = bare paper). Dividing out the background removes shadows and uneven
 * lighting before any thresholding.
 */
function normalisedLuminance(pixels: Pixels): Float32Array {
  const { width, height } = pixels;
  const lum = luminance(pixels);
  const background = estimateBackground({ lum, width, height });
  for (let i = 0; i < lum.length; i++) {
    lum[i] = lum[i] / Math.max(background[i], 1);
  }
  return lum;
}

function writeGrey({
  values,
  size,
}: {
  values: Float32Array;
  size: { width: number; height: number };
}): Pixels {
  const out = createPixels(size);
  for (let i = 0, j = 0; j < values.length; i += 4, j++) {
    const v = values[j] * 255;
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  return out;
}

/**
 * Value at the given quantile (0..1) of normalised luminance, via a histogram
 * over 0..1 (values above 1 — brighter than the local paper — count as 1).
 */
export function luminanceQuantile({
  values,
  quantile,
}: {
  values: Float32Array;
  quantile: number;
}): number {
  const bins = 256;
  const histogram = new Uint32Array(bins);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    histogram[v >= 1 ? bins - 1 : v <= 0 ? 0 : (v * bins) | 0]++;
  }
  // At least one sample, so quantile 0 returns the minimum rather than 0
  const target = Math.max(1, quantile * values.length);
  let seen = 0;
  for (let bin = 0; bin < bins; bin++) {
    seen += histogram[bin];
    if (seen >= target) return bin / bins;
  }
  return 1;
}

/**
 * B&W tuning. The ink level is the darkest `inkQuantile` of the page, so faint
 * pencil is stretched to black just like printed text; `maxInkLevel` stops a
 * blank page's paper grain being stretched into speckle. Between the `ink`
 * and `paper` points (as fractions of the ink→paper range) is a smooth ramp
 * so strokes stay anti-aliased instead of jagged.
 */
export const BW_TUNING = {
  inkQuantile: 0.005,
  maxInkLevel: 0.8,
  ink: 0.3,
  paper: 0.75,
};

function inkLevelOf(values: Float32Array): number {
  return Math.min(
    BW_TUNING.maxInkLevel,
    luminanceQuantile({ values, quantile: BW_TUNING.inkQuantile }),
  );
}

/** "Scanned document" look: white paper, black ink, no shadows */
export function blackAndWhite(pixels: Pixels): Pixels {
  const values = normalisedLuminance(pixels);
  const inkLevel = inkLevelOf(values);
  const range = 1 - inkLevel;
  const ink = inkLevel + range * BW_TUNING.ink;
  const paper = inkLevel + range * BW_TUNING.paper;
  for (let i = 0; i < values.length; i++) {
    const t = (values[i] - ink) / (paper - ink);
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    // Smoothstep keeps the ramp from looking washed out mid-tone
    values[i] = clamped * clamped * (3 - 2 * clamped);
  }
  return writeGrey({ values, size: pixels });
}

/** Shadow-free greyscale that keeps tonal detail (photos, pencil shading) */
export function greyscale(pixels: Pixels): Pixels {
  const values = normalisedLuminance(pixels);
  // Linear stretch: darkest ink → black, near-paper → white, tones kept
  const inkLevel = inkLevelOf(values);
  const white = 0.95;
  for (let i = 0; i < values.length; i++) {
    const t = (values[i] - inkLevel) / (white - inkLevel);
    values[i] = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  return writeGrey({ values, size: pixels });
}

export function applyScanFilter({
  pixels,
  filter,
}: {
  pixels: Pixels;
  filter: ScanFilter;
}): Pixels {
  switch (filter) {
    case "bw":
      return blackAndWhite(pixels);
    case "grey":
      return greyscale(pixels);
    case "original":
      return pixels;
  }
}

export function isScanFilter(value: unknown): value is ScanFilter {
  return SCAN_FILTERS.some((filter) => filter === value);
}
