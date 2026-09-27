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

/** Darkest lighting the page is assumed to have, relative to its bright paper */
const MIN_LIGHTING_FRACTION = 0.5;

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

  // A big dark region (a black banner, a photo) isn't paper in shadow: floor
  // the estimate at a fraction of the page's paper brightness, so it isn't
  // divided out into white. Real shadows rarely darken paper this much
  const paperLevel = [...smooth].sort((x, y) => x - y)[
    Math.floor(smooth.length * 0.9)
  ];
  const floor = paperLevel * MIN_LIGHTING_FRACTION;
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i] < floor) smooth[i] = floor;
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
 * The page's ink level: its darkest 0.5%, capped so a blank page's grain isn't
 * stretched into speckle. Stretching this to black makes faint pencil as dark
 * as print; on pages that already have solid black it changes nothing.
 */
function inkLevelOf(values: Float32Array): number {
  return Math.min(
    MAX_INK_LEVEL,
    luminanceQuantile({ values, quantile: 0.005 }),
  );
}

const MAX_INK_LEVEL = 0.8;

/** Rescales so the page's ink level becomes 0 and bare paper stays 1 */
function stretchToInk(values: Float32Array): void {
  const inkLevel = inkLevelOf(values);
  const range = 1 - inkLevel;
  for (let i = 0; i < values.length; i++) {
    values[i] = (values[i] - inkLevel) / range;
  }
}

/**
 * B&W tuning (on normalised luminance stretched to the page's ink level, so
 * bare paper ≈ 1 and the darkest ink ≈ 0):
 * - Each pixel is compared with the mean of its neighbourhood (a window of
 *   `windowFraction` of the page's long edge), so thin or grey text only has
 *   to be darker than the paper around it — a global threshold washes it out
 *   when the page also has big black areas that set the "ink" level
 * - `sensitivity`: how far below the local mean counts as ink
 * - `softness`: half-width of the ramp around the threshold, keeping strokes
 *   anti-aliased rather than jagged
 * - Outside `[ink, paper]` the answer is absolute: solid black areas (where the
 *   local mean is itself dark) stay black, and paper grain stays white
 */
export const BW_TUNING = {
  // Small enough that the edges of printed photos only mark a thin band
  windowFraction: 1 / 60,
  sensitivity: 0.17,
  softness: 0.07,
  ink: 0.35,
  paper: 0.92,
};

/**
 * Summed-area table of `values` ((width+1)×(height+1), zero first row/column),
 * so any window's sum is four lookups. Float32 keeps it to one page-sized
 * buffer: sums stay under ~5M for a capped page, where float32 error is well
 * below what a threshold notices.
 */
function summedArea({
  values,
  width,
  height,
}: {
  values: Float32Array;
  width: number;
  height: number;
}): Float32Array {
  const stride = width + 1;
  const table = new Float32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += values[y * width + x];
      table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + rowSum;
    }
  }
  return table;
}

/** "Scanned document" look: white paper, black ink, no shadows */
export function blackAndWhite(pixels: Pixels): Pixels {
  const { width, height } = pixels;
  const values = normalisedLuminance(pixels);
  stretchToInk(values);
  const { windowFraction, sensitivity, softness, ink, paper } = BW_TUNING;
  const radius = Math.max(
    4,
    Math.round(Math.max(width, height) * windowFraction),
  );
  const table = summedArea({ values, width, height });
  const stride = width + 1;
  // The neighbourhood mean is read from the table per pixel rather than kept
  // in another page-sized buffer; the table was built before any pixel
  // changes, so `values` can be rewritten in place
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = values[i];
      if (v <= ink) {
        values[i] = 0;
        continue;
      }
      if (v >= paper) {
        values[i] = 1;
        continue;
      }
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const mean =
        (table[y1 * stride + x1] -
          table[y0 * stride + x1] -
          table[y1 * stride + x0] +
          table[y0 * stride + x0]) /
        ((x1 - x0) * (y1 - y0));
      const threshold = mean * (1 - sensitivity);
      const t = (v - (threshold - softness)) / (2 * softness);
      const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
      values[i] = clamped * clamped * (3 - 2 * clamped);
    }
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
