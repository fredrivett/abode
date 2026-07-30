import sharp from "sharp";

// Source edge (px) of the placeholder. The card applies the blur in screen space
// (CSS filter) at render, so the stored image stays crisp and only needs enough
// resolution to carry the broad structure through that blur; kept small for the
// inline payload.
const BLUR_MAX_EDGE = 96;

/**
 * Generate a tiny low-res placeholder data URL (LQIP) from image bytes. Shipped
 * inline with the items payload; the card renders it with a CSS blur while the
 * full image loads, so the grid paints something instantly with no extra request.
 *
 * Best-effort: returns null (never throws) when the bytes can't be decoded — e.g.
 * a HEIC original without libheif support — so it can't fail the surrounding
 * analysis. Callers store the null and fall back to the dominant-colour gradient.
 */
export async function generateBlurDataUrl(
  buffer: Buffer,
): Promise<string | null> {
  try {
    const webp = await sharp(buffer)
      .rotate() // honour EXIF orientation so the placeholder matches the shown image
      .resize(BLUR_MAX_EDGE, BLUR_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      // Low quality is invisible — the card CSS-blurs this at render, so webp
      // artifacts are hidden. Keeps the inline payload small.
      .webp({ quality: 40 })
      .toBuffer();
    return `data:image/webp;base64,${webp.toString("base64")}`;
  } catch {
    return null;
  }
}
