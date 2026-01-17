/**
 * Color matching utilities for search filters.
 *
 * Uses CIE76 deltaE formula to calculate perceptual color difference.
 * Colors within deltaE ≤ 5.0 are considered a match.
 */

// Named colors to hex mapping
// These are the canonical color names that can be stored and filtered in the database
export const NAMED_COLORS: Record<string, string> = {
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0000FF",
  yellow: "#FFFF00",
  orange: "#FFA500",
  purple: "#800080",
  pink: "#FFC0CB",
  brown: "#A52A2A",
  black: "#000000",
  white: "#FFFFFF",
  gray: "#808080",
  grey: "#808080",
  cyan: "#00FFFF",
  magenta: "#FF00FF",
  navy: "#000080",
  teal: "#008080",
  olive: "#808000",
  maroon: "#800000",
  silver: "#C0C0C0",
  gold: "#FFD700",
  coral: "#FF7F50",
  salmon: "#FA8072",
  turquoise: "#40E0D0",
  indigo: "#4B0082",
  violet: "#EE82EE",
  beige: "#F5F5DC",
  khaki: "#F0E68C",
  lavender: "#E6E6FA",
  mint: "#98FF98",
  peach: "#FFDAB9",
};

/**
 * Convert named color to hex, or return hex as-is if already hex format.
 */
export function normalizeColor(color: string): string | null {
  const trimmed = color.trim().toLowerCase();

  // Check if it's already a hex color
  if (trimmed.startsWith("#")) {
    // Validate hex format
    const hex = trimmed.slice(1);
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      // Expand 3-char hex to 6-char
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
    }
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      return `#${hex}`.toUpperCase();
    }
    return null;
  }

  // Try named color lookup
  const namedHex = NAMED_COLORS[trimmed];
  return namedHex || null;
}

/**
 * Parse hex color to RGB components.
 */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const normalized = normalizeColor(hex);
  if (!normalized) return null;

  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!result) return null;

  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to LAB color space for perceptual comparison.
 */
export function rgbToLab(rgb: { r: number; g: number; b: number }): {
  l: number;
  a: number;
  b: number;
} {
  // Convert RGB to XYZ
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
  g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
  b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;

  r *= 100;
  g *= 100;
  b *= 100;

  // Observer = 2°, Illuminant = D65
  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  // Convert XYZ to LAB
  let xr = x / 95.047;
  let yr = y / 100.0;
  let zr = z / 108.883;

  xr = xr > 0.008856 ? xr ** (1 / 3) : 7.787 * xr + 16 / 116;
  yr = yr > 0.008856 ? yr ** (1 / 3) : 7.787 * yr + 16 / 116;
  zr = zr > 0.008856 ? zr ** (1 / 3) : 7.787 * zr + 16 / 116;

  return {
    l: 116 * yr - 16,
    a: 500 * (xr - yr),
    b: 200 * (yr - zr),
  };
}

/**
 * Convert hex color directly to LAB color space.
 * Convenience function combining hexToRgb and rgbToLab.
 */
export function hexToLab(
  hex: string,
): { l: number; a: number; b: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToLab(rgb);
}

/**
 * Calculate CIE76 deltaE between two colors.
 * Lower values mean more similar colors.
 */
export function deltaE(color1: string, color2: string): number | null {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return null;

  const lab1 = rgbToLab(rgb1);
  const lab2 = rgbToLab(rgb2);

  const dL = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;

  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Check if two colors are perceptually similar (deltaE ≤ threshold).
 */
export function colorsMatch(
  color1: string,
  color2: string,
  threshold = 5.0,
): boolean {
  const delta = deltaE(color1, color2);
  return delta !== null && delta <= threshold;
}

/**
 * Calculate color similarity as a proximity value (0-1).
 * 1 = exact match, 0 = very different.
 */
export function colorProximity(color1: string, color2: string): number | null {
  const delta = deltaE(color1, color2);
  if (delta === null) return null;

  // Map deltaE 0-100 to proximity 1-0
  // deltaE of 0 = proximity 1
  // deltaE of ~25 or more = proximity ~0
  return Math.max(0, 1 - delta / 25);
}

/**
 * Get the list of canonical color names for filtering.
 */
export function getColorNames(): string[] {
  // Return unique names (grey is alias for gray)
  return Object.keys(NAMED_COLORS).filter((name) => name !== "grey");
}

/**
 * Find the nearest named color for a given hex value.
 * Uses deltaE to find the perceptually closest match.
 *
 * @param hex - Hex color string (e.g., "#FF5733")
 * @returns The name of the nearest color, or null if hex is invalid
 */
export function getNearestColorName(hex: string): string | null {
  const normalizedHex = normalizeColor(hex);
  if (!normalizedHex) return null;

  let nearestName: string | null = null;
  let nearestDelta = Infinity;

  // Skip "grey" since it's an alias for "gray"
  for (const [name, namedHex] of Object.entries(NAMED_COLORS)) {
    if (name === "grey") continue;

    const delta = deltaE(normalizedHex, namedHex);
    if (delta !== null && delta < nearestDelta) {
      nearestDelta = delta;
      nearestName = name;
    }
  }

  return nearestName;
}
