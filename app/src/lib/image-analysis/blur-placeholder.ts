import sharp from "sharp";

// Largest edge (px) of the blur placeholder. Kept tiny — the card blurs it with
// CSS, so extra detail is just wasted base64 bytes in the items payload.
const BLUR_MAX_EDGE = 32;

/**
 * Generate a tiny blurred-placeholder data URL (LQIP) from image bytes. Shipped
 * inline with the items payload and shown blurred while the full image loads, so
 * the grid paints something instantly with no extra request.
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
      .rotate() // honour EXIF orientation so the blur matches the shown image
      .resize(BLUR_MAX_EDGE, BLUR_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 45 })
      .toBuffer();
    return `data:image/webp;base64,${webp.toString("base64")}`;
  } catch {
    return null;
  }
}
