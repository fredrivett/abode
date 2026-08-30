import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@trigger.dev/sdk";
import { safeFetch } from "@/lib/http/safe-fetch";
import { parseMimeType } from "@/lib/url-utils";

// Only re-host raster formats the renderers actually support. Notably excludes
// SVG: the image proxy serves stored bytes same-origin as image/svg+xml, so a
// persisted SVG (e.g. a malicious third-party image) becomes active content when
// opened directly. These images come from arbitrary third-party pages, so this
// allowlist is a real boundary, not a formality.
const IMAGE_EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/**
 * Storage extension for a re-hostable image content-type, or null to reject it
 * (unsupported or unsafe, e.g. SVG). Exported for testing.
 */
export function imageExtForContentType(contentType: string): string | null {
  return IMAGE_EXT_BY_CONTENT_TYPE[parseMimeType(contentType)] ?? null;
}

/**
 * Downloads an image from a URL and stores it in Supabase storage.
 * Returns the file key and byte size, or null on any failure (skip cleanly).
 * Shared by the platform handlers (Twitter, Instagram) and the tweet-image
 * backfill to re-host third-party media into our own storage.
 */
export async function downloadAndStoreImage(
  imageUrl: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ fileKey: string; size: number } | null> {
  try {
    // The image URL comes from an arbitrary third-party page, so route it
    // through safeFetch to keep it off internal hosts.
    const response = await safeFetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
      },
    });
    if (!response.ok) {
      logger.warn("Failed to download image", {
        imageUrl,
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const ext = imageExtForContentType(contentType);
    if (!ext) {
      logger.warn("Image had unsupported content-type", {
        imageUrl,
        contentType: contentType || "(none)",
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileKey = `${userId}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("items")
      .upload(fileKey, buffer, { contentType, upsert: false });
    if (uploadError) {
      logger.error("Failed to upload image to storage", {
        imageUrl,
        error: uploadError,
      });
      return null;
    }

    return { fileKey, size: buffer.length };
  } catch (error) {
    logger.error("Error downloading/storing image", { imageUrl, error });
    return null;
  }
}
