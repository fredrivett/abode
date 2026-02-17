import type { Palette } from "@vibrant/color";
import { Vibrant } from "node-vibrant/node";
import { getNearestColorName, hexToLab } from "../search/color-utils";
import type { ImageColor } from "../types/item";

export type VibrantColor = {
  hex: string;
  name: string;
  population: number;
  paletteType: string;
  l?: number;
  a?: number;
  b?: number;
};

export type VibrantResult = {
  colors: VibrantColor[];
  rawPalette: Palette;
};

/**
 * Extract dominant colors from an image using node-vibrant
 */
export async function extractColorsWithVibrant(
  imageBuffer: Buffer,
): Promise<VibrantResult> {
  const palette = await Vibrant.from(imageBuffer).getPalette();

  const colors: VibrantColor[] = [];

  const paletteEntries: [string, typeof palette.Vibrant][] = [
    ["Vibrant", palette.Vibrant],
    ["Muted", palette.Muted],
    ["DarkVibrant", palette.DarkVibrant],
    ["DarkMuted", palette.DarkMuted],
    ["LightVibrant", palette.LightVibrant],
    ["LightMuted", palette.LightMuted],
  ];

  for (const [paletteType, swatch] of paletteEntries) {
    if (swatch) {
      const hex = swatch.hex;
      const name = getNearestColorName(hex);
      const lab = hexToLab(hex);

      colors.push({
        hex,
        name: name || "unknown",
        population: swatch.population,
        paletteType,
        ...(lab && { l: lab.l, a: lab.a, b: lab.b }),
      });
    }
  }

  return {
    colors,
    rawPalette: palette,
  };
}

/**
 * Convert VibrantColor array to ImageColor array (for compatibility with existing schema)
 */
export function vibrantColorsToImageColors(
  vibrantColors: VibrantColor[],
): ImageColor[] {
  return vibrantColors.map((color) => ({
    hex: color.hex,
    name: color.name,
    score: color.population / 10000, // Normalize population to a 0-1 score
    ...(color.l !== undefined && { l: color.l, a: color.a, b: color.b }),
  }));
}
