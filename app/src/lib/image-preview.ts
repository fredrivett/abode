// Source edge (px) of the placeholder. The card blurs it in screen space (CSS)
// at render, so the stored image stays crisp; kept small for the inline payload
const BLUR_MAX_EDGE = 96;

export type ImagePreview = {
  width: number;
  height: number;
  /** Tiny base64 data URL shown blurred while the full image loads (LQIP) */
  blurDataUrl: string | null;
};

/**
 * Read an image's dimensions and generate a tiny blurred-placeholder data URL
 * from the same decode, so the grid can show something instantly on load.
 * The placeholder is best-effort — failure never blocks the upload.
 *
 * Browser-only (uses `Image`/`canvas`); call from client code.
 */
export async function getImagePreview(file: File): Promise<ImagePreview> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;

      let blurDataUrl: string | null = null;
      try {
        const scale = Math.min(
          BLUR_MAX_EDGE / width,
          BLUR_MAX_EDGE / height,
          1,
        );
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // Low quality is invisible (the card CSS-blurs it) and keeps it tiny.
          // Safari lacks webp encode and silently falls back to png — still small.
          blurDataUrl = canvas.toDataURL("image/webp", 0.4);
        }
      } catch {
        // Placeholder is a nice-to-have; swallow and continue
      }

      resolve({ width, height, blurDataUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
