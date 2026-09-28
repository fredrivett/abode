import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imageSize } from "image-size";
import { safeFetch } from "@/lib/http/safe-fetch";
import { generateBlurDataUrl } from "@/lib/image-analysis/blur-placeholder";
import { imageExtForContentType } from "@/lib/media/rehost-image";

export type StoredCover = {
  fileKey: string;
  size: number;
  width: number;
  height: number;
  /** Local LQIP data URL (from sharp), or null if the bytes couldn't be blurred. */
  blurDataUrl: string | null;
};

/**
 * Download a book cover from a remote URL and store it in the `items` bucket,
 * returning its key/dims + a locally-computed blur placeholder.
 *
 * Mirrors classify-url's cover path (safeFetch → content-type + image-size proof
 * → Supabase upload) but is **best-effort**: any failure (blocked/unreachable
 * URL, non-image body, unparseable bytes, upload error) returns null so a missing
 * or bad cover never fails the surrounding book import. Unlike classify-url it
 * computes `blurDataUrl` inline (no paid vision pass — book covers get no value
 * from it; see the book-import plan).
 */
export async function downloadAndStoreCover({
  coverUrl,
  userId,
  supabase,
}: {
  coverUrl: string;
  userId: string;
  supabase: SupabaseClient;
}): Promise<StoredCover | null> {
  try {
    const response = await safeFetch(coverUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
      },
    });
    if (!response.ok) return null;

    // Raster allowlist (rejects SVG etc.) — the image proxy serves stored bytes
    // same-origin, so an SVG cover would become active content. Real boundary.
    const contentType = response.headers.get("content-type") || "";
    const ext = imageExtForContentType(contentType);
    if (!ext) return null;

    const buffer = Buffer.from(await response.arrayBuffer());

    let width = 0;
    let height = 0;
    try {
      const dims = imageSize(buffer);
      width = dims.width ?? 0;
      height = dims.height ?? 0;
    } catch {
      return null; // bytes aren't a real image despite the content-type
    }

    const fileKey = `${userId}/${randomUUID()}${ext}`;
    const { error } = await supabase.storage
      .from("items")
      .upload(fileKey, buffer, { contentType, upsert: false });
    if (error) return null;

    const blurDataUrl = await generateBlurDataUrl(buffer);
    return { fileKey, size: buffer.length, width, height, blurDataUrl };
  } catch {
    return null;
  }
}
